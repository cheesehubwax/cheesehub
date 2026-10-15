// Reads an account's token transfers from Hyperion, oldest → newest, with a
// timestamp cursor per provider (skip paging stops at 10,000 rows). Several
// providers are read and UNIONED by global sequence, because a single
// provider can silently hold only part of the history.
import { DEFAULT_HYPERION_ENDPOINTS, type HyperionActionRecord } from '../hyperionHistory';
import { resolveEndpoints } from '../endpointHealth';
import type { ProviderCursor, StoredFolio } from './storage';
import type { RawTransfer } from './types';

const PAGE = 1000;
/** Providers read in parallel for the union. */
const PROVIDERS = 3;
const PAGE_TIMEOUT_MS = 20_000;

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

async function fetchPage(url: string): Promise<HyperionActionRecord[] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.ok) return ((await res.json()) as { actions?: HyperionActionRecord[] }).actions ?? [];
      if (res.status === 400 || res.status === 404) return null;
    } catch {
      /* retry */
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  return null;
}

export interface ScanProgress {
  transfers: number;
  /** Newest block time reached so far (epoch ms), for the progress text. */
  reachedTs: number | null;
  providersDone: number;
  providers: number;
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
  const endpoints = (await resolveEndpoints('hyperion-v2', DEFAULT_HYPERION_ENDPOINTS)).slice(0, PROVIDERS);
  const seen = new Set(rec.transfers.map((t) => t.gs));
  let reachedTs = rec.transfers.length ? Math.max(...rec.transfers.map((t) => t.ts)) : null;
  let done = 0;
  let ok = 0;

  const readProvider = async (base: string) => {
    const cursor: ProviderCursor = rec.cursors[base] ?? { after: null, caughtUp: false };
    rec.cursors[base] = cursor;
    const root = `${base.replace(/\/$/, '')}/v2/history/get_actions?account=${rec.account}&filter=*:transfer&sort=asc&limit=${PAGE}`;
    for (;;) {
      if (signal?.aborted) return false;
      const url = cursor.after ? `${root}&after=${encodeURIComponent(cursor.after)}` : root;
      const actions = await fetchPage(url);
      if (!actions) return false;
      let added = 0;
      let lastTs: number | null = null;
      for (const a of actions) {
        const t = toRawTransfer(a);
        const ts = (a['@timestamp'] ?? a.timestamp) as string | undefined;
        const pt = ts ? Date.parse(ts.endsWith('Z') ? ts : `${ts}Z`) : NaN;
        if (Number.isFinite(pt)) lastTs = pt;
        if (!t || seen.has(t.gs)) continue;
        seen.add(t.gs);
        rec.transfers.push(t);
        added++;
        if (reachedTs == null || t.ts > reachedTs) reachedTs = t.ts;
      }
      // Move the cursor 1 ms back so rows sharing the page-edge block are
      // re-read (and de-duplicated) instead of lost.
      if (lastTs != null) {
        const next = new Date(lastTs - 1).toISOString();
        const stalled = next === cursor.after && added === 0;
        cursor.after = next;
        if (stalled) {
          cursor.caughtUp = true;
          await onPage(rec, { transfers: rec.transfers.length, reachedTs, providersDone: done, providers: endpoints.length });
          return true;
        }
      }
      await onPage(rec, { transfers: rec.transfers.length, reachedTs, providersDone: done, providers: endpoints.length });
      if (actions.length < PAGE) {
        cursor.caughtUp = true;
        return true;
      }
    }
  };

  await Promise.all(
    endpoints.map(async (e) => {
      const success = await readProvider(e).catch(() => false);
      done++;
      if (success) ok++;
    }),
  );
  rec.transfers.sort((a, b) => a.gs - b.gs);
  if (ok > 0) rec.syncedAt = Date.now();
  await onPage(rec, { transfers: rec.transfers.length, reachedTs, providersDone: done, providers: endpoints.length });
  return { providersOk: ok };
}
