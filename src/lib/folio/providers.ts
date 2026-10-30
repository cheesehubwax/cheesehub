// Hyperion history providers for CHEESEFolio: probing, choosing which to
// read, page fetching and the completeness rules. Pure helpers live here so
// the sync loop in scanner.ts only orchestrates.
import type { HyperionActionRecord } from '../hyperionHistory';
import type { RawTransfer } from './types';

/** Providers read in parallel for the union. */
export const PROVIDERS = 3;
const PAGE_TIMEOUT_MS = 15_000;
const PROBE_TIMEOUT_MS = 6_000;
export const CREATOR_TIMEOUT_MS = 8_000;

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

/** True when a Hyperion get_creator answer includes the creation transaction (the node indexed that block). */
export function creationIndexed(body: unknown): boolean {
  const b = body as { trx_id?: string; block_num?: number } | null;
  return !!b && typeof b.trx_id === 'string' && b.trx_id.length > 0 && (b.block_num ?? 0) > 0;
}

/** True when the oldest history found starts more than a day after the account was created. */
export function hasCoverageGap(coverageFrom: number | null | undefined, accountCreated: number | null | undefined): boolean {
  if (accountCreated == null || coverageFrom == null) return false;
  return coverageFrom - accountCreated > 86_400_000;
}

/**
 * A sync is complete when the deepest provider (always first) was read to the
 * end. Shallower providers only add cover for its holes; one that dropped out
 * keeps its cursor and is caught up on the next sync instead of blocking this one.
 */
export function isSyncComplete(endpoints: string[], succeeded: Set<string>): boolean {
  return endpoints.length > 0 && succeeded.has(endpoints[0]);
}

export const parseTs = (ts: string | undefined) => (ts ? Date.parse(ts.endsWith('Z') ? ts : `${ts}Z`) : NaN);

/** An AbortController that fires on its own timeout or when `outer` aborts. */
export function linkedAbort(timeoutMs: number, outer?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  if (outer?.aborted) ctrl.abort();
  else outer?.addEventListener('abort', onAbort);
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onAbort);
    },
  };
}

/** Waits `ms`, ending early (without throwing) when `signal` aborts. */
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Hosts that answer a tiny history read from this browser. */
export async function probeProviders(account: string, candidates: string[], signal?: AbortSignal): Promise<ProbeResult[]> {
  const results = await Promise.all(
    candidates.map(async (base) => {
      const link = linkedAbort(PROBE_TIMEOUT_MS, signal);
      const t0 = performance.now();
      try {
        const res = await fetch(`${base.replace(/\/$/, '')}/v2/history/get_actions?account=${account}&filter=*:transfer&sort=asc&limit=1`, { signal: link.signal });
        if (!res.ok) return null;
        const body = (await res.json()) as { actions?: HyperionActionRecord[] };
        if (!Array.isArray(body.actions)) return null;
        const first = body.actions[0];
        const t = parseTs((first?.['@timestamp'] ?? first?.timestamp) as string | undefined);
        return { base, ms: performance.now() - t0, earliestTs: Number.isFinite(t) ? t : null };
      } catch {
        return null;
      } finally {
        link.done();
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
  const t = parseTs((a['@timestamp'] ?? a.timestamp) as string | undefined);
  if (!Number.isFinite(t)) return null;
  return {
    gs: Number(a.global_sequence), trx: a.trx_id, ts: t, contract: a.act.account,
    from: d.from, to: d.to, quantity, memo: typeof d.memo === 'string' ? d.memo : '',
    ord: a.action_ordinal, parent: a.creator_action_ordinal,
  };
}

export type PageResult = { actions: HyperionActionRecord[] } | { maxLimit: number } | null;

/** One history page with retries; returns null at once when `signal` aborts. */
export async function fetchPage(url: string, signal?: AbortSignal): Promise<PageResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (signal?.aborted) return null;
    const link = linkedAbort(PAGE_TIMEOUT_MS, signal);
    let wait = 800 * (attempt + 1);
    try {
      const res = await fetch(url, { signal: link.signal });
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
      link.done();
    }
    await abortableDelay(wait, signal);
  }
  return null;
}
