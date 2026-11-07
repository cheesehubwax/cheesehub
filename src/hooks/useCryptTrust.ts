import { useEffect, useState } from 'react';
import { fetchTableRows, waxRpcCall } from '@/lib/waxRpcFallback';
import { normalizeEndpoint, resolveEndpoints, benchEndpoint } from '@/lib/endpointHealth';
import { fetchAlcorCheese } from '@/lib/folio/pooled';
import { lookupFirstKeyTime, lookupPublishedKey } from '@/lib/cheeseCrypt';
import type { TrustSignals } from '@/lib/cryptTrust';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

/** Cached read; failures resolve to null (unknown) and are not cached. */
async function cached<T>(key: string, ttl: number, read: () => Promise<T>): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) { p = read(); inflight.set(key, p); }
  try { const v = await p; cache.set(key, { at: Date.now(), value: v }); return v; }
  catch { return null; }
  finally { inflight.delete(key); }
}

const qty = (asset: unknown) => { const n = Number(String(asset ?? '').trim().split(' ')[0]); if (!Number.isFinite(n)) throw new Error('bad asset'); return n; };

async function readCreated(account: string): Promise<number> {
  const r = await waxRpcCall<{ created?: string }>('/v1/chain/get_account', { account_name: account });
  const t = Date.parse(String(r?.created ?? '') + (String(r?.created ?? '').endsWith('Z') ? '' : 'Z'));
  if (!Number.isFinite(t)) throw new Error('no created');
  return t;
}

async function readCheese(account: string): Promise<number> {
  const r = await waxRpcCall<string[]>('/v1/chain/get_currency_balance', { code: 'cheeseburger', account, symbol: 'CHEESE' });
  if (!Array.isArray(r)) throw new Error('bad balance');
  return r.length ? qty(r[0]) : 0;
}

async function readStake(account: string): Promise<number> {
  const r = await fetchTableRows<{ staker: string; cheesestaked: string }>({ code: 'cheesecheese', scope: 'cheesecheese', table: 'staketable', lower_bound: account, upper_bound: account, limit: 1 });
  const row = r?.rows?.find(x => x.staker === account);
  return row ? qty(row.cheesestaked) : 0;
}

async function readNfts(account: string): Promise<number> {
  let last: unknown = null;
  for (const raw of await resolveEndpoints('atomic-assets-api')) {
    const base = normalizeEndpoint(raw);
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 10_000);
      const res = await fetch(`${base}/atomicassets/v1/accounts/${encodeURIComponent(account)}?collection_whitelist=cheesenftwax`, { signal: ctl.signal }).finally(() => clearTimeout(t));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      if (!j?.success || !Array.isArray(j.data?.collections)) throw new Error('bad response');
      const c = j.data.collections.find((x: { collection?: { collection_name?: string } }) => x?.collection?.collection_name === 'cheesenftwax');
      return c ? Number(c.assets) || 0 : 0;
    } catch (e) { last = e; benchEndpoint(base); }
  }
  throw last instanceof Error ? last : new Error('NFT lookup failed');
}

async function readKey(account: string): Promise<{ published: boolean; firstAt: number | null }> {
  const [current, firstAt] = await Promise.all([lookupPublishedKey(account), lookupFirstKeyTime(account)]);
  return { published: !!current, firstAt: current ? firstAt : null };
}

export async function loadTrustSignals(account: string): Promise<TrustSignals> {
  const [createdAt, cheese, staked, pooled, nfts, key] = await Promise.all([
    cached(`age:${account}`, DAY_MS, () => readCreated(account)),
    cached(`cheese:${account}`, HOUR_MS, () => readCheese(account)),
    cached(`stake:${account}`, HOUR_MS, () => readStake(account)),
    cached(`pool:${account}`, HOUR_MS, () => fetchAlcorCheese(account)),
    cached(`nft:${account}`, HOUR_MS, () => readNfts(account)),
    cached(`key:${account}`, DAY_MS, () => readKey(account)),
  ]);
  return { account, createdAt, cheese, staked, pooled, nfts, key };
}

/** Loads signals once `enabled` (the badge is on screen). */
export function useCryptTrust(account: string, enabled: boolean) {
  const [signals, setSignals] = useState<TrustSignals | null>(null);
  useEffect(() => {
    if (!enabled || !account) return;
    let live = true;
    setSignals(null);
    void loadTrustSignals(account).then(s => { if (live) setSignals(s); });
    return () => { live = false; };
  }, [account, enabled]);
  return signals;
}
