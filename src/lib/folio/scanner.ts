// Reads an account's token transfers from Hyperion, oldest → newest, with a
// timestamp cursor per provider (skip paging stops at 10,000 rows). Several
// providers are read and UNIONED by global sequence, because a single
// provider can silently hold only part of the history. Provider helpers live
// in providers.ts and order-book fill lookups in fills.ts.
import { DEFAULT_HYPERION_ENDPOINTS } from '../hyperionHistory';
import { resolveEndpoints } from '../endpointHealth';
import type { ProviderCursor, ScanWindow, StoredFolio } from './storage';
import { mapLimit } from '../chainRequest';
import { waxRpcCall } from '../waxRpcFallback';
import { applyAlcorDeals, fetchAlcorDeals, fetchAlcorMarkets } from './alcorDeals';
import {
  abortableDelay, CREATOR_TIMEOUT_MS, creationIndexed, fetchPage, hasCoverageGap, isSyncComplete,
  linkedAbort, parseTs, probeProviders, selectProviders, toRawTransfer,
} from './providers';
import { enrichFills, FILL_CONCURRENCY, isFill } from './fills';

export {
  creationIndexed, hasCoverageGap, isSyncComplete, selectProviders, toRawTransfer, type ProbeResult,
} from './providers';
export { fillGaveFromActions, probeTxProviders, txProvidersFor, type TxProvider } from './fills';

const PAGE = 1000;
/**
 * Date windows a small-page provider's history is split into when it is read
 * from the start. Only providers capping pages below PAGE are windowed; big-page
 * providers finish in a few sequential requests and bursts make them drop
 * connections (api.waxsweden.org timed out under 8 parallel windows).
 */
const BACKFILL_WINDOWS = 8;
/** Windows read at once on one provider (EOSDAC allows roughly 4 requests/s). */
const WINDOW_CONCURRENCY = 3;
/** Providers read at once. */
const PROVIDER_CONCURRENCY = 2;
/**
 * Extra history services tried after the health-ordered shared list. Each one
 * is probed from this browser first, so a host that is down or blocked here
 * is skipped in seconds instead of stalling the scan.
 */
const FOLIO_HYPERION_EXTRA = ['https://wax.eosdac.io', 'https://wax-history.eosdac.io', 'https://wax.eosusa.io', 'https://wax.eosphere.io', 'https://api.waxsweden.org'];

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
  rec.partial = true;
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
  // A first transfer days after creation may just mean the account was idle.
  // If the deepest provider holds the account's creation transaction, its
  // history reaches day one.
  if (endpoints[0] && Number.isFinite(createdTs) && hasCoverageGap(rec.coverageFrom, createdTs)) {
    const link = linkedAbort(CREATOR_TIMEOUT_MS, signal);
    const reaches = await fetch(`${endpoints[0]}/v2/history/get_creator?account=${rec.account}`, { signal: link.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => creationIndexed(b))
      .catch(() => false)
      .finally(link.done);
    if (reaches) rec.coverageFrom = createdTs;
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
      const page = await fetchPage(url, signal);
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
        // Learn the page cap with a tiny read (rows up to 1 s after the first).
        if (cursor.limit == null) {
          const capProbe = await fetchPage(
            `${base}/v2/history/get_actions?account=${rec.account}&filter=*:transfer&sort=asc&limit=${PAGE}&before=${encodeURIComponent(new Date(start + 1000).toISOString())}`,
            signal,
          );
          if (capProbe && 'maxLimit' in capProbe && capProbe.maxLimit > 0) cursor.limit = capProbe.maxLimit;
        }
        if ((cursor.limit ?? PAGE) < PAGE) {
          const end = Date.now();
          const step = Math.max(1, Math.ceil((end - start) / BACKFILL_WINDOWS));
          cursor.windows = Array.from({ length: BACKFILL_WINDOWS }, (_, i) => ({
            after: new Date(start + i * step - 1).toISOString(),
            before: i === BACKFILL_WINDOWS - 1 ? null : new Date(start + (i + 1) * step).toISOString(),
            done: false,
          }));
        }
      }
    }
    if (cursor.windows) {
      const results = await mapLimit(cursor.windows.filter((w) => !w.done), WINDOW_CONCURRENCY, (w) => readRange(base, cursor, w).catch(() => false));
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

  const succeeded = new Set<string>();
  // Deepest provider first (selectProviders order), at most two at a time.
  await mapLimit(endpoints, PROVIDER_CONCURRENCY, async (e) => {
    {
      // A provider that drops out part-way resumes from its saved windows,
      // so a retry only re-reads what is missing.
      let success = false;
      for (let pass = 0; pass < 3 && !success && !signal?.aborted; pass++) {
        if (pass) await abortableDelay(2000 * pass, signal);
        success = await readProvider(e).catch(() => false);
      }
      done++;
      if (success) {
        ok++;
        succeeded.add(e);
      }
    }
  });
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
  const complete = isSyncComplete(endpoints, succeeded);
  if (complete && !signal?.aborted) {
    rec.syncedAt = Date.now();
    rec.partial = false;
  }
  await onPage(rec, { transfers: rec.transfers.length, reachedTs, providersDone: done, providers: endpoints.length, phase: 'done' });
  return { providersOk: ok, providers: endpoints.length, complete };
}
