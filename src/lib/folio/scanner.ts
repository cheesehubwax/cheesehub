// Reads an account's token transfers from Hyperion, oldest → newest, with a
// timestamp cursor per provider (skip paging stops at 10,000 rows). Several
// providers are read and UNIONED by global sequence, because a single
// provider can silently hold only part of the history.
import { DEFAULT_HYPERION_ENDPOINTS, type HyperionActionRecord } from '../hyperionHistory';
import { resolveEndpoints } from '../endpointHealth';
import type { ProviderCursor, ScanWindow, StoredFolio } from './storage';
import type { RawTransfer } from './types';
import { mapLimit } from '../chainRequest';
import { waxRpcCall } from '../waxRpcFallback';
import { applyAlcorDeals, fetchAlcorDeals, fetchAlcorMarkets } from './alcorDeals';

const PAGE = 1000;
/** Providers read in parallel for the union. */
const PROVIDERS = 3;
const PAGE_TIMEOUT_MS = 15_000;
const PROBE_TIMEOUT_MS = 6_000;
/** One transaction lookup; slow hosts are skipped rather than waited on. */
const TX_TIMEOUT_MS = 5_000;
const TX_PROBE_TIMEOUT_MS = 4_000;
/** Date windows read in parallel when a provider is read from the start. */
const BACKFILL_WINDOWS = 8;
/** Order-book fill lookups in flight per provider. */
const FILL_CONCURRENCY = 12;
/**
 * Extra history services tried alongside the shared list. Each one is probed
 * from this browser first, so a host that is down or blocked here is skipped
 * in seconds instead of stalling the scan.
 */
const FOLIO_HYPERION_EXTRA = ['https://wax.eosdac.io', 'https://wax-history.eosdac.io', 'https://wax.eosusa.io', 'https://wax.eosphere.io', 'https://api.waxsweden.org'];

export interface ProbeResult {
  base: string;
  ms: number;
  /** Oldest transfer this provider holds for the account (epoch ms), null if none. */
  earliestTs: number | null;
}

/**
 * Chooses which providers to read: the one reaching furthest back is always
 * included (it is the only one that can hold the full record), then the
 * fastest of the rest fill any holes.
 */
export function selectProviders(probes: ProbeResult[], max = PROVIDERS): string[] {
  const withData = probes.filter((p) => p.earliestTs != null);
  const deepest = [...withData].sort((a, b) => a.earliestTs! - b.earliestTs! || a.ms - b.ms)[0];
  const rest = probes.filter((p) => p !== deepest).sort((a, b) => a.ms - b.ms);
  return [...(deepest ? [deepest] : []), ...rest].slice(0, max).map((p) => p.base);
}

/** True when the oldest history found starts more than a day after the account was created. */
export function hasCoverageGap(coverageFrom: number | null | undefined, accountCreated: number | null | undefined): boolean {
  if (accountCreated == null || coverageFrom == null) return false;
  return coverageFrom - accountCreated > 86_400_000;
}

const parseTs = (ts: string | undefined) => (ts ? Date.parse(ts.endsWith('Z') ? ts : `${ts}Z`) : NaN);

/** Hosts that answer a tiny history read from this browser. */
async function probeProviders(account: string, candidates: string[], signal?: AbortSignal): Promise<ProbeResult[]> {
  const results = await Promise.all(
    candidates.map(async (base) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      const onAbort = () => ctrl.abort();
      signal?.addEventListener('abort', onAbort);
      const t0 = performance.now();
      try {
        const res = await fetch(`${base.replace(/\/$/, '')}/v2/history/get_actions?account=${account}&filter=*:transfer&sort=asc&limit=1`, { signal: ctrl.signal });
        if (!res.ok) return null;
        const body = (await res.json()) as { actions?: HyperionActionRecord[] };
        if (!Array.isArray(body.actions)) return null;
        const first = body.actions[0];
        const t = parseTs((first?.['@timestamp'] ?? first?.timestamp) as string | undefined);
        return { base, ms: performance.now() - t0, earliestTs: Number.isFinite(t) ? t : null };
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
    }),
  );
  return results.filter((r): r is ProbeResult => !!r);
}

export function toRawTransfer(a: HyperionActionRecord): RawTransfer | null {
  if (a.act?.name !== 'transfer' || !a.act.account) return null;
  const d = a.act.data ?? {};
  const quantity = d.quantity;
  if (typeof quantity !== 'string' || typeof d.from !== 'string' || typeof d.to !== 'string') return null;
  if (a.global_sequence == null || !a.trx_id) return null;
  const ts = (a['@timestamp'] ?? a.timestamp) as string | undefined;
  const t = ts ? Date.parse(ts.endsWith('Z') ? ts : `${ts}Z`) : NaN;
  if (!Number.isFinite(t)) return null;
  return {
    gs: Number(a.global_sequence), trx: a.trx_id, ts: t, contract: a.act.account,
    from: d.from, to: d.to, quantity, memo: typeof d.memo === 'string' ? d.memo : '',
    ord: a.action_ordinal, parent: a.creator_action_ordinal,
  };
}

type PageResult = { actions: HyperionActionRecord[] } | { maxLimit: number } | null;

async function fetchPage(url: string): Promise<PageResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT_MS);
    let wait = 800 * (attempt + 1);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.status === 429) wait = Math.min(8000, 1500 * 2 ** attempt);
      if (res.ok) return { actions: ((await res.json()) as { actions?: HyperionActionRecord[] }).actions ?? [] };
      // Some providers cap the page size (e.g. "limit too big, maximum: 100").
      const text = await res.text().catch(() => '');
      const cap = /limit too big, maximum:\s*(\d+)/i.exec(text);
      if (cap) return { maxLimit: Number(cap[1]) };
      if (res.status === 400 || res.status === 404) return null;
    } catch {
      /* retry */
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, wait));
  }
  return null;
}

const isFill = (t: RawTransfer, account: string) =>
  t.from === 'alcordexmain' && t.to === account && /order match/i.test(t.memo);

interface MatchRecord {
  bid?: string;
  ask?: string;
  market?: { base_token?: { sym?: string; contract?: string }; quote_token?: { sym?: string; contract?: string } };
  bidder?: string;
  asker?: string;
}

const symOf = (asset: string | undefined) => asset?.trim().split(/\s+/)[1];
const amountOf = (asset: string | undefined) => parseFloat(asset?.trim().split(/\s+/)[0] ?? 'NaN');

/**
 * What the account gave for one order-book fill. The fill's `sellmatch` /
 * `buymatch` record has both sides; whichever side equals what the account
 * received, the other side is what it gave. Role-agnostic on purpose.
 */
export function fillGaveFromActions(actions: HyperionActionRecord[], account: string, t: RawTransfer): RawTransfer['fillGave'] {
  const gotSym = symOf(t.quantity);
  const gotAmt = amountOf(t.quantity);
  const records = actions
    .filter((a) => a.act?.account === 'alcordexmain' && /match$/.test(a.act?.name ?? ''))
    .map((a) => (a.act?.data as { record?: MatchRecord } | undefined)?.record)
    .filter((r): r is MatchRecord => !!r && (r.bidder === account || r.asker === account));
  for (const r of records) {
    for (const [got, gave] of [[r.bid, r.ask], [r.ask, r.bid]] as const) {
      if (symOf(got) !== gotSym || Math.abs(amountOf(got) - gotAmt) > 1e-9) continue;
      const gaveSym = symOf(gave);
      const side = [r.market?.base_token, r.market?.quote_token].find((x) => x?.sym?.split(',')[1] === gaveSym);
      if (gave && side?.contract) return { contract: side.contract, quantity: gave };
    }
  }
  return null;
}

async function fetchTx(base: string, trx: string, timeoutMs = TX_TIMEOUT_MS): Promise<HyperionActionRecord[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/v2/history/get_transaction?id=${trx}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const actions = ((await res.json()) as { actions?: HyperionActionRecord[] }).actions;
    return Array.isArray(actions) && actions.length ? actions : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Keeps only providers that answer one real transaction lookup quickly. */
export async function probeTxProviders(
  bases: string[],
  trx: string,
  fetcher: (base: string, trx: string, timeoutMs: number) => Promise<unknown[] | null> = fetchTx,
): Promise<string[]> {
  const ok = await Promise.all(bases.map(async (b) => ((await fetcher(b, trx, TX_PROBE_TIMEOUT_MS)) ? b : null)));
  return ok.filter((b): b is string => !!b);
}

export interface TxProvider {
  base: string;
  /** Oldest transfer this provider holds for the account (epoch ms). */
  earliestTs: number | null;
  /** Lookups in flight at once on this provider. */
  slots: number;
}

/**
 * Providers that can hold a transaction at `ts`, fastest first. A provider
 * whose history starts later than the fill is skipped instead of asked.
 */
export function txProvidersFor(ts: number, providers: TxProvider[]): TxProvider[] {
  return providers.filter((p) => p.earliestTs != null && p.earliestTs <= ts + 60_000);
}

/**
 * Looks up every order-book fill not yet checked. Each fill goes to the
 * fastest provider whose history reaches back to it, with a cap on lookups
 * in flight per provider, so a slow full-history host only gets the old
 * fills nobody else has. A lookup that fails moves on to the next provider;
 * anything still unchecked is retried on the next sync.
 */
async function enrichFills(
  providers: TxProvider[],
  account: string,
  transfers: RawTransfer[],
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
) {
  const byTrx = new Map<string, RawTransfer[]>();
  for (const t of transfers) if (isFill(t, account) && !t.fillChecked) byTrx.set(t.trx, [...(byTrx.get(t.trx) ?? []), t]);
  const jobs = [...byTrx.entries()].sort((x, y) => y[1][0].ts - x[1][0].ts);
  const total = jobs.length;
  if (!total || !providers.length) return;
  onProgress(0, total);
  // Probe with the newest fill so providers holding only recent history pass.
  const passed = new Set(await probeTxProviders(providers.map((p) => p.base), jobs[0][0]));
  const working = providers.filter((p) => passed.has(p.base));
  if (!working.length || signal?.aborted) return;
  const busy = new Map(working.map((p) => [p.base, 0]));
  const waiters: (() => void)[] = [];
  const release = (base: string) => {
    busy.set(base, (busy.get(base) ?? 1) - 1);
    waiters.splice(0).forEach((w) => w());
  };
  /** Waits for a free slot on the first provider in `order` that has one. */
  const acquire = async (order: TxProvider[]): Promise<TxProvider | null> => {
    for (;;) {
      if (signal?.aborted) return null;
      const free = order.find((p) => (busy.get(p.base) ?? 0) < p.slots);
      if (free) {
        busy.set(free.base, (busy.get(free.base) ?? 0) + 1);
        return free;
      }
      await new Promise<void>((r) => waiters.push(r));
    }
  };
  let done = 0;
  const totalSlots = working.reduce((s, p) => s + p.slots, 0);
  // Busy full-history hosts sometimes refuse a burst; a short second and
  // third pass over what is left recovers those without a new sync.
  let remaining = jobs;
  for (let pass = 0; pass < 3 && remaining.length && !signal?.aborted; pass++) {
    if (pass) await new Promise((r) => setTimeout(r, 1500 * pass));
    await runPass(remaining, pass > 0);
    remaining = remaining.filter(([, list]) => !list[0].fillChecked);
  }
  async function runPass(batch: typeof jobs, retry: boolean) {
  await mapLimit(batch, retry ? Math.max(4, Math.floor(totalSlots / 3)) : totalSlots, async ([trx, list]) => {
    let order = txProvidersFor(list[0].ts, working);
    while (order.length && !signal?.aborted) {
      const p = await acquire(order);
      if (!p) break;
      let actions: HyperionActionRecord[] | null = null;
      try {
        actions = await fetchTx(p.base, trx);
      } finally {
        release(p.base);
      }
      if (actions) {
        for (const t of list) {
          t.fillGave = fillGaveFromActions(actions, account, t);
          t.fillChecked = true;
        }
        break;
      }
      order = order.filter((x) => x !== p);
    }
    if (!retry) done++;
    if (done % 10 === 0 || done === total) onProgress(done, total);
  });
  }
  onProgress(done, total);
}

export interface ScanProgress {
  transfers: number;
  /** Newest block time reached so far (epoch ms), for the progress text. */
  reachedTs: number | null;
  providersDone: number;
  providers: number;
  phase: 'probing' | 'history' | 'fills' | 'done';
  fillsDone?: number;
  fillsTotal?: number;
}

/**
 * Brings `rec` up to date in place. `onPage` is called after every page with
 * the merged record so callers can persist and show progress; a scan that is
 * interrupted resumes from the saved cursors next time.
 */
export async function syncFolio(
  rec: StoredFolio,
  onPage: (rec: StoredFolio, p: ScanProgress) => Promise<void> | void,
  signal?: AbortSignal,
): Promise<{ providersOk: number; providers: number; complete: boolean }> {
  await onPage(rec, { transfers: rec.transfers.length, reachedTs: null, providersDone: 0, providers: 0, phase: 'probing' });
  const shared = await resolveEndpoints('hyperion-v2', DEFAULT_HYPERION_ENDPOINTS, 8).catch(() => DEFAULT_HYPERION_ENDPOINTS);
  const candidates = [...new Set([...shared, ...FOLIO_HYPERION_EXTRA].map((u) => u.replace(/\/+$/, '')))];
  const [probes, created] = await Promise.all([
    probeProviders(rec.account, candidates, signal),
    waxRpcCall<{ created?: string }>('/v1/chain/get_account', { account_name: rec.account }).catch(() => null),
  ]);
  const createdTs = parseTs(created?.created);
  if (Number.isFinite(createdTs)) rec.accountCreated = createdTs;
  const endpoints = selectProviders(probes);
  const starts = probes.filter((p) => endpoints.includes(p.base) && p.earliestTs != null).map((p) => p.earliestTs!);
  if (starts.length) {
    const from = Math.min(...starts);
    rec.coverageFrom = rec.coverageFrom == null ? from : Math.min(rec.coverageFrom, from);
  }
  const seen = new Set(rec.transfers.map((t) => t.gs));
  let reachedTs = rec.transfers.length ? Math.max(...rec.transfers.map((t) => t.ts)) : null;
  let done = 0;
  let ok = 0;

  // Alcor's deal list explains most order-book fills in one request; start it
  // now so it downloads while history is read.
  const dealsP = Promise.all([fetchAlcorDeals(rec.account, signal), fetchAlcorMarkets(signal)]).catch(() => [null, null] as const);

  const earliestOf = new Map(probes.map((p) => [p.base, p.earliestTs]));

  /** Reads one time range oldest → newest, moving `range.after` forward. */
  const readRange = async (base: string, cursor: ProviderCursor, range: ScanWindow): Promise<boolean> => {
    for (;;) {
      if (signal?.aborted) return false;
      const limit = cursor.limit ?? PAGE;
      let url = `${base}/v2/history/get_actions?account=${rec.account}&filter=*:transfer&sort=asc&limit=${limit}`;
      if (range.after) url += `&after=${encodeURIComponent(range.after)}`;
      if (range.before) url += `&before=${encodeURIComponent(range.before)}`;
      const page = await fetchPage(url);
      if (!page) return false;
      if ('maxLimit' in page) {
        if (!(page.maxLimit > 0) || page.maxLimit >= limit) return false;
        cursor.limit = page.maxLimit;
        continue;
      }
      const { actions } = page;
      let added = 0;
      let lastTs: number | null = null;
      for (const a of actions) {
        const t = toRawTransfer(a);
        const pt = parseTs((a['@timestamp'] ?? a.timestamp) as string | undefined);
        if (Number.isFinite(pt)) lastTs = pt;
        if (!t || seen.has(t.gs)) continue;
        seen.add(t.gs);
        rec.transfers.push(t);
        added++;
        if (reachedTs == null || t.ts > reachedTs) reachedTs = t.ts;
      }
      // Move the cursor 1 ms back so rows sharing the page-edge block are
      // re-read (and de-duplicated) instead of lost.
      let stalled = false;
      if (lastTs != null) {
        const next = new Date(lastTs - 1).toISOString();
        stalled = next === range.after && added === 0;
        range.after = next;
      }
      await onPage(rec, { transfers: rec.transfers.length, reachedTs, providersDone: done, providers: endpoints.length, phase: 'history' });
      if (stalled || actions.length < limit) {
        range.done = true;
        return true;
      }
    }
  };

  const readProvider = async (base: string) => {
    const cursor: ProviderCursor = rec.cursors[base] ?? { after: null, caughtUp: false };
    rec.cursors[base] = cursor;
    // First read of a provider: split its whole history into date windows
    // read side by side, so small-page providers are not one long queue.
    if (!cursor.caughtUp && cursor.after == null && !cursor.windows) {
      const start = earliestOf.get(base);
      if (start != null) {
        const end = Date.now();
        const step = Math.max(1, Math.ceil((end - start) / BACKFILL_WINDOWS));
        cursor.windows = Array.from({ length: BACKFILL_WINDOWS }, (_, i) => ({
          after: new Date(start + i * step - 1).toISOString(),
          before: i === BACKFILL_WINDOWS - 1 ? null : new Date(start + (i + 1) * step).toISOString(),
          done: false,
        }));
      }
    }
    if (cursor.windows) {
      const results = await Promise.all(cursor.windows.filter((w) => !w.done).map((w) => readRange(base, cursor, w).catch(() => false)));
      if (results.some((r) => !r) || cursor.windows.some((w) => !w.done)) return false;
      // Backfill complete: continue incrementally from the newest window.
      cursor.after = cursor.windows[cursor.windows.length - 1].after;
      cursor.windows = undefined;
      cursor.caughtUp = true;
      return true;
    }
    const range: ScanWindow = { after: cursor.after, before: null, done: false };
    const ok = await readRange(base, cursor, range);
    cursor.after = range.after;
    if (ok) cursor.caughtUp = true;
    return ok;
  };

  await Promise.all(
    endpoints.map(async (e) => {
      // A provider that drops out part-way resumes from its saved windows,
      // so a retry only re-reads what is missing.
      let success = false;
      for (let pass = 0; pass < 3 && !success && !signal?.aborted; pass++) {
        if (pass) await new Promise((r) => setTimeout(r, 2000 * pass));
        success = await readProvider(e).catch(() => false);
      }
      done++;
      if (success) ok++;
    }),
  );
  rec.transfers.sort((a, b) => a.gs - b.gs);
  // Order-book fills need their match record to know what was given.
  if (ok > 0) {
    const [deals, markets] = await dealsP;
    if (deals && markets) applyAlcorDeals(rec.transfers, deals, markets, rec.account, (t) => isFill(t, rec.account));
    const txProviders = [...probes]
      .sort((x, y) => x.ms - y.ms)
      .map((p) => ({ base: p.base, earliestTs: p.earliestTs, slots: FILL_CONCURRENCY }));
    await enrichFills(txProviders, rec.account, rec.transfers, (fd, ft) => {
      void onPage(rec, { transfers: rec.transfers.length, reachedTs, providersDone: done, providers: endpoints.length, phase: 'fills', fillsDone: fd, fillsTotal: ft });
    }, signal);
  }
  // Only "up to date" when every chosen provider was read to the end; a
  // partly read history would show wrong profit/loss.
  const complete = endpoints.length > 0 && ok === endpoints.length;
  if (complete) rec.syncedAt = Date.now();
  await onPage(rec, { transfers: rec.transfers.length, reachedTs, providersDone: done, providers: endpoints.length, phase: 'done' });
  return { providersOk: ok, providers: endpoints.length, complete };
}
