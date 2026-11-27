// CHEESECrypt account-named chain reads (CHEESE balance, Instant Messaging status, router and
// curator tables) honour the saved loopback Tor helper: v1.4+ carries them, an older helper or no
// helper keeps the public path, and a saved helper that is unreachable fails closed.
import { chainPost } from '@/lib/chainRequest';
import { MediaRoute, resolveChainReadRoute } from '@/lib/cryptMediaProxy';

export class ChainReadBlockedError extends Error {
  constructor() { super('Tor helper not reachable'); this.name = 'ChainReadBlockedError'; }
}

const HELPER_TIMEOUT_MS = 30_000;

/** One read through the helper only; nodeos error replies (4xx) are returned as errors, never retried publicly. */
export async function helperChainPost<T>(base: string, path: string, body: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), HELPER_TIMEOUT_MS);
  try {
    const res = await fetcher(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`Tor helper HTTP ${res.status}`);
    return await res.json() as T;
  } finally { clearTimeout(t); }
}

/** Pure dispatch, exported for tests. */
export async function routedChainPost<T>(route: MediaRoute, path: string, body: Record<string, unknown>, io: {
  helper: typeof helperChainPost; pub: (path: string, body: Record<string, unknown>) => Promise<T>;
} = { helper: helperChainPost, pub: (p, b) => chainPost<T>(p, b) }): Promise<T> {
  if (route.kind === 'blocked') throw new ChainReadBlockedError();
  if (route.kind === 'tor') return io.helper<T>(route.base, path, body);
  return io.pub(path, body);
}

export async function cryptChainPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return routedChainPost<T>(await resolveChainReadRoute(), path, body);
}

/** CHEESE-style token balance through the routed read; null when unknown (helper down or read failed). */
export async function cryptTokenBalance(account: string, code: string, symbol: string): Promise<number | null> {
  try {
    const rows = await cryptChainPost<string[]>('/v1/chain/get_currency_balance', { code, account, symbol });
    if (!Array.isArray(rows)) return null;
    return rows.length ? parseFloat(String(rows[0]).split(' ')[0]) : 0;
  } catch { return null; }
}
