// CHEESEAir — snapshot every account registered under a name suffix (e.g. ".gm").
//
// On WAX only the owner of a suffix account can create names ending in it, so
// the full list is exactly the `newaccount` actions that suffix account signed.
// Read as a union across Hyperion providers so a thin index can't drop names.
import { DEFAULT_HYPERION_ENDPOINTS, type HyperionActionRecord } from './hyperionHistory';
import { resolveEndpoints } from './endpointHealth';
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
const PROVIDER_BUDGET_MS = 180_000;

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
async function readProvider(base: string, suffix: string): Promise<ProviderRead> {
  const names = new Set<string>();
  const deadline = Date.now() + PROVIDER_BUDGET_MS;
  let before: string | null = null;
  const root = `${base.replace(/\/$/, '')}/v2/history/get_actions?account=${suffix}&filter=eosio:newaccount&limit=${PAGE}`;
  for (;;) {
    if (names.size >= MAX_ACCOUNTS || Date.now() > deadline) return { names, complete: false };
    let actions: HyperionActionRecord[] | null = null;
    for (let attempt = 0; attempt < 3 && !actions; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), Math.max(1000, Math.min(30_000, deadline - Date.now())));
      try {
        const res = await fetch(before ? `${root}&before=${encodeURIComponent(before)}` : root, { signal: ctrl.signal });
        if (res.ok) actions = ((await res.json()) as { actions?: HyperionActionRecord[] }).actions ?? [];
      } catch {
        /* retry */
      } finally {
        clearTimeout(timer);
      }
      if (!actions) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    if (!actions) return { names, complete: false };
    const sizeBefore = names.size;
    for (const n of suffixAccountsFromActions(actions, suffix)) names.add(n);
    if (actions.length < PAGE) return { names, complete: true };
    const last = actions[actions.length - 1];
    const ts = (last['@timestamp'] ?? last.timestamp) as string | undefined;
    const t = ts ? Date.parse(ts.endsWith('Z') ? ts : `${ts}Z`) : NaN;
    // No progress or no usable cursor: stop rather than loop forever.
    if (!Number.isFinite(t) || (names.size === sizeBefore && before !== null)) return { names, complete: true };
    const next = new Date(t + 1).toISOString();
    if (next === before) return { names, complete: true };
    before = next;
  }
}

export async function getSuffixHolders(input: string): Promise<HolderSnapshot> {
  const suffix = normaliseSuffix(input);
  if (!suffix) throw new Error('Enter a valid account suffix (e.g. gm)');
  if (suffix === 'wam' || suffix.endsWith('.wam')) {
    throw new Error('Cloud Wallet (.wam) accounts are not supported — there are millions of them');
  }
  const endpoints = await resolveEndpoints('hyperion-v2', DEFAULT_HYPERION_ENDPOINTS);
  // Providers index different slices of history, so the list is their union.
  const reads = await Promise.all(endpoints.map((e) => readProvider(e, suffix)));
  const all = new Set<string>();
  for (const r of reads) for (const n of r.names) all.add(n);
  const accounts = [...all].sort();
  if (accounts.length === 0) throw new Error(`No accounts found ending in .${suffix}`);
  return {
    holders: accounts.slice(0, MAX_ACCOUNTS).map((account) => ({ account, weight: 1, raw: '1' })),
    // Flag when no provider read its whole history (or the cap was hit).
    truncated: accounts.length >= MAX_ACCOUNTS || !reads.some((r) => r.complete && r.names.size > 0),
    source: 'hyperion-suffix',
    hasBalances: false,
  };
}
