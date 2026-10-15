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

const PAGE = 1000;
/** Providers read in parallel for the union. */
const PROVIDERS = 3;
const PAGE_TIMEOUT_MS = 15_000;
const PROBE_TIMEOUT_MS = 6_000;
/** Date windows read in parallel when a provider is read from the start. */
const BACKFILL_WINDOWS = 8;
/** Order-book fill lookups in flight per provider. */
const FILL_CONCURRENCY = 8;
/**
 * Extra history services tried alongside the shared list. Each one is probed
 * from this browser first, so a host that is down or blocked here is skipped
 * in seconds instead of stalling the scan.
 */
const FOLIO_HYPERION_EXTRA = ['https://wax.eosdac.io', 'https://wax.eosusa.io', 'https://wax.eosphere.io', 'https://api.waxsweden.org'];

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

async function fetchTx(base: string, trx: string): Promise<HyperionActionRecord[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/v2/history/get_transaction?id=${trx}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    return ((await res.json()) as { actions?: HyperionActionRecord[] }).actions ?? [];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Looks up every unchecked order-book fill, spreading the transactions over
 * all working providers at once. A lookup that fails on one provider is
 * retried on the next; anything still unchecked is retried on the next sync.
 */
async function enrichFills(
  bases: string[],
  account: string,
  transfers: RawTransfer[],
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
) {
  const byTrx = new Map<string, RawTransfer[]>();
  for (const t of transfers) if (isFill(t, account) && !t.fillChecked) byTrx.set(t.trx, [...(byTrx.get(t.trx) ?? []), t]);
  const jobs = [...byTrx.entries()];
  const total = jobs.length;
  if (!total || !bases.length) return;
  let done = 0;
  onProgress(0, total);
  await mapLimit(jobs.map((j, i) => [j, i] as const), FILL_CONCURRENCY * bases.length, async ([[trx, list], i]) => {
    for (let k = 0; k < bases.length; k++) {
      if (signal?.aborted) return;
      const actions = await fetchTx(bases[(i + k) % bases.length], trx);
      if (!actions) continue;
      for (const t of list) {
        t.fillGave = fillGaveFromActions(actions, account, t);
        t.fillChecked = true;
      }
      break;
    }
    done++;
    if (done % 10 === 0 || done === total) onProgress(done, total);
  });
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
): Promise<{ providersOk: number }> {
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
      const success = await readProvider(e).catch(() => false);
      done++;
      if (success) ok++;
    }),
  );
  rec.transfers.sort((a, b) => a.gs - b.gs);
  // Order-book fills need their match record to know what was given.
  if (ok > 0) {
    await enrichFills(endpoints, rec.account, rec.transfers, (fd, ft) => {
      void onPage(rec, { transfers: rec.transfers.length, reachedTs, providersDone: done, providers: endpoints.length, phase: 'fills', fillsDone: fd, fillsTotal: ft });
    }, signal);
  }
  if (ok > 0) rec.syncedAt = Date.now();
  await onPage(rec, { transfers: rec.transfers.length, reachedTs, providersDone: done, providers: endpoints.length, phase: 'done' });
  return { providersOk: ok };
}
