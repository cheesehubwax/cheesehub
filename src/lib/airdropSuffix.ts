// CHEESEAir — snapshot every account registered under a name suffix (e.g. ".gm").
//
// On WAX only the owner of a suffix account can create names ending in it, so
// the full list is exactly the `newaccount` actions that suffix account signed.
// Read as a union across Hyperion providers so a thin index can't drop names.
import { DEFAULT_HYPERION_ENDPOINTS, type HyperionActionRecord } from './hyperionHistory';
import { resolveEndpoints, benchEndpoint, clearBench, BENCH_MS } from './endpointHealth';
import { mapLimit } from './chainRequest';
import type { HolderSnapshot } from './airdropChain';

const NAME_RE = /^[a-z1-5.]{1,12}$/;

/** Normalise user input like ".GM" or " gm " to "gm"; null when not a valid name. */
export function normaliseSuffix(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/^\.+/, '');
  if (!s || s.endsWith('.') || s.includes('..') || !NAME_RE.test(s)) return null;
  return s;
}

/** Accounts created by `suffix` whose name ends in `.suffix`, de-duplicated and sorted. */
export function suffixAccountsFromActions(actions: HyperionActionRecord[], suffix: string): string[] {
  const tail = `.${suffix}`;
  const out = new Set<string>();
  for (const a of actions) {
    if (a.act?.account !== 'eosio' || a.act?.name !== 'newaccount') continue;
    const data = a.act.data ?? {};
    const name = (data.newact ?? data.name) as unknown;
    if (data.creator !== suffix || typeof name !== 'string') continue;
    if (name.length > tail.length && name.endsWith(tail) && NAME_RE.test(name)) out.add(name);
  }
  return [...out].sort();
}

const PAGE = 1000;
const MAX_ACCOUNTS = 100_000;
const PROVIDER_BUDGET_MS = 8_000;
const REQUEST_TIMEOUT_MS = 2_500;
const CACHE_TTL_MS = 60_000;
const snapshotCache = new Map<string, { at: number; snapshot: HolderSnapshot }>();
const inFlight = new Map<string, Promise<HolderSnapshot>>();

interface ProviderRead {
  names: Set<string>;
  /** False when the provider stopped early (error, budget or cap). */
  complete: boolean;
}

/**
 * Walks one provider newest-to-oldest with a timestamp cursor. Skip-based paging
 * hits Elasticsearch's 10,000-row window, so `before` moves instead. The cursor
 * is nudged 1 ms forward so rows sharing a block with the page edge are re-read
 * (de-duplicated) rather than lost. Partial reads are kept, never thrown away.
 */
async function readProvider(base: string, suffix: string, deadline: number): Promise<ProviderRead> {
  const names = new Set<string>();
  let before: string | null = null;
  const root = `${base.replace(/\/$/, '')}/v2/history/get_actions?account=${suffix}&filter=eosio:newaccount&sort=desc&limit=${PAGE}`;
  for (;;) {
    if (names.size >= MAX_ACCOUNTS || Date.now() >= deadline) return { names, complete: false };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()));
    let actions: HyperionActionRecord[];
    try {
      const res = await fetch(before ? `${root}&before=${encodeURIComponent(before)}` : root, { signal: ctrl.signal });
      if (!res.ok) {
        benchEndpoint(base, res.status === 429 || res.status === 420 ? BENCH_MS.rateLimited : BENCH_MS.error);
        return { names, complete: false };
      }
      const data = await res.json() as { actions?: HyperionActionRecord[] };
      if (!Array.isArray(data.actions)) return { names, complete: false };
      actions = data.actions;
      clearBench(base);
    } catch {
      benchEndpoint(base, BENCH_MS.network);
      return { names, complete: false };
    } finally {
      clearTimeout(timer);
    }
    for (const n of suffixAccountsFromActions(actions, suffix)) names.add(n);
    if (actions.length < PAGE) return { names, complete: true };
    const last = actions[actions.length - 1];
    const ts = (last?.['@timestamp'] ?? last?.timestamp) as string | undefined;
    const t = ts ? Date.parse(ts.endsWith('Z') ? ts : `${ts}Z`) : NaN;
    // No progress or no usable cursor: stop rather than loop forever.
    if (!Number.isFinite(t)) return { names, complete: false };
    const next = new Date(t + 1).toISOString();
    if (before !== null && next >= before) return { names, complete: false };
    before = next;
  }
}

export async function getSuffixHolders(input: string): Promise<HolderSnapshot> {
  const suffix = normaliseSuffix(input);
  if (!suffix) throw new Error('Enter a valid account suffix (e.g. gm)');
  if (suffix === 'wam' || suffix.endsWith('.wam')) {
    throw new Error('Cloud Wallet (.wam) accounts are not supported — there are millions of them');
  }
  const cached = snapshotCache.get(suffix);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return structuredClone(cached.snapshot);
  const pending = inFlight.get(suffix);
  if (pending) return structuredClone(await pending);
  const request = loadSuffixHolders(suffix);
  inFlight.set(suffix, request);
  try {
    const snapshot = await request;
    // Partial reads are never promoted into a fresh complete cached snapshot.
    if (!snapshot.truncated) snapshotCache.set(suffix, { at: Date.now(), snapshot });
    return structuredClone(snapshot);
  } finally {
    inFlight.delete(suffix);
  }
}

async function loadSuffixHolders(suffix: string): Promise<HolderSnapshot> {
  const endpoints = await resolveEndpoints('hyperion-v2', DEFAULT_HYPERION_ENDPOINTS);
  // Providers index different slices of history, so the list is their union.
  // One shared deadline also bounds queued providers; no retry waits on dead hosts.
  const deadline = Date.now() + PROVIDER_BUDGET_MS;
  const reads = await mapLimit(endpoints, 4, (e) => readProvider(e, suffix, deadline));
  const all = new Set<string>();
  for (const r of reads) for (const n of r.names) all.add(n);
  const accounts = [...all].sort();
  if (accounts.length === 0) throw new Error(reads.some((r) => !r.complete)
    ? `History providers could not finish loading .${suffix}. Please try again.`
    : `No accounts found ending in .${suffix}`);
  return {
    holders: accounts.slice(0, MAX_ACCOUNTS).map((account) => ({ account, weight: 1, raw: '1' })),
    // Any missing provider can contain names absent from the other indexes.
    truncated: accounts.length >= MAX_ACCOUNTS || reads.some((r) => !r.complete),
    source: 'hyperion-suffix',
    hasBalances: false,
  };
}
