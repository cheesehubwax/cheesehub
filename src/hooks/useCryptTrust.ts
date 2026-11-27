import { useEffect, useState } from 'react';
import { fetchTableRows, waxRpcCall } from '@/lib/waxRpcFallback';
import { normalizeEndpoint, resolveEndpoints, benchEndpoint } from '@/lib/endpointHealth';
import { fetchAlcorCheese } from '@/lib/folio/pooled';
import { lookupFirstKeyTime, lookupPublishedKey } from '@/lib/cheeseCrypt';
import type { TrustSignals } from '@/lib/cryptTrust';
import { getPermanent, setPermanent } from '@/lib/cryptTrustPermanent';
import { resolveRespectRoute } from '@/lib/cryptMediaProxy';
import { getSnapshot, setSnapshot, snapshotAccounts } from '@/lib/cryptTrustSnapshot';
import { jitterMs, pickDecoy, shuffle } from '@/lib/cryptTrustChaff';

/**
 * Where Respect's public lookups go. Public by default; with a saved v1.4+ Tor helper
 * every lookup (chain, Alcor, AtomicAssets) goes only through it, with no public fallback.
 */
interface TrustIO {
  rpc: <T>(path: string, body: Record<string, unknown>) => Promise<T>;
  table: typeof fetchTableRows;
  nftAccount: (account: string) => Promise<unknown>;
  alcorPositions: (account: string) => Promise<unknown>;
}

async function publicNftAccount(account: string): Promise<unknown> {
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
      return j;
    } catch (e) { last = e; benchEndpoint(base); }
  }
  throw last instanceof Error ? last : new Error('NFT lookup failed');
}

const PUBLIC_IO: TrustIO = {
  rpc: (path, body) => waxRpcCall(path, body),
  table: fetchTableRows,
  nftAccount: publicNftAccount,
  alcorPositions: () => { throw new Error('public Alcor reads use the default path'); },
};

const TOR_TIMEOUT_MS = 30_000;
async function helperJson(url: string, init?: RequestInit, onStatus?: (status: number) => unknown): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TOR_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, cache: 'no-store' });
    const special = onStatus?.(res.status);
    if (special !== undefined) return special;
    if (!res.ok) throw new Error(`Tor helper HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

/** Exported for tests: every read goes to the loopback helper only. */
export function torTrustIO(base: string): TrustIO {
  const post = (path: string, body: Record<string, unknown>) => helperJson(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, status => path === '/v1/chain/get_currency_balance' && (status === 400 || status === 500) ? [] : undefined);
  return {
    rpc: post as TrustIO['rpc'],
    table: (params => post('/v1/chain/get_table_rows', { json: true, ...params })) as typeof fetchTableRows,
    nftAccount: account => helperJson(`${base}/atomic/v1/accounts/${encodeURIComponent(account)}?collection_whitelist=cheesenftwax`),
    alcorPositions: account => helperJson(`${base}/alcor/v2/account/${encodeURIComponent(account)}/positions`),
  };
}

const DAY_MS = 86_400_000;
const FAILURE_COOLDOWN_MS = 120_000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

/** Signals kept on this device for 24 hours (age and first key time are permanent elsewhere). */
const PERSISTED = new Set(['cheese', 'stake', 'pool', 'nft', 'key']);
const persisted = (key: string) => PERSISTED.has(key.slice(0, key.indexOf(':')));

/** Memory first, then the 24-hour device snapshot (hydrated into memory). */
function peek(key: string): { expiresAt: number; value: unknown } | null {
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit;
  if (!persisted(key)) return null;
  const stored = getSnapshot(key);
  if (!stored) return null;
  cache.set(key, stored);
  return stored;
}

/** Failures remain unknown, with a short cooldown rather than repeated reads. */
async function cached<T>(key: string, ttl: number, read: () => Promise<T>): Promise<T | null> {
  const hit = peek(key);
  if (hit) return hit.value as T | null;
  const pending = inflight.get(key) as Promise<T | null> | undefined;
  if (pending) return pending;
  const request = Promise.resolve().then(read).then(value => {
    cache.set(key, { expiresAt: Date.now() + (value == null ? FAILURE_COOLDOWN_MS : ttl), value });
    if (value != null && persisted(key)) setSnapshot(key, value);
    return value;
  }).catch(() => {
    cache.set(key, { expiresAt: Date.now() + FAILURE_COOLDOWN_MS, value: null });
    return null;
  }).finally(() => { inflight.delete(key); });
  inflight.set(key, request);
  return request;
}

let chaffEnabled = true;
/** Tests only: turn decoy lookups off to count real reads exactly. */
export function __setTrustChaff(on: boolean) { chaffEnabled = on; }
const chaffing = new Set<string>();
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Decoy reads mirror the real ones; results are discarded and never cached. */
function decoyReads(decoy: string, io: TrustIO, alcorIO: Parameters<typeof fetchAlcorCheese>[1], withAge: boolean): Promise<void> {
  const reads: (() => Promise<unknown>)[] = [
    () => readCheese(decoy, io),
    () => readStake(decoy, io),
    () => fetchAlcorCheese(decoy, alcorIO),
    () => readNfts(decoy, io),
  ];
  if (withAge) reads.push(() => io.rpc('/v1/chain/get_account', { account_name: decoy }));
  return Promise.all(shuffle(reads).map(r => Promise.resolve().then(r).catch(() => null))).then(() => undefined);
}

const qty = (asset: unknown) => { const n = Number(String(asset ?? '').trim().split(' ')[0]); if (!Number.isFinite(n)) throw new Error('bad asset'); return n; };

async function readCreated(account: string, io: TrustIO): Promise<number> {
  const known = getPermanent('created', account);
  if (known != null) return known;
  const r = await io.rpc<{ created?: string }>('/v1/chain/get_account', { account_name: account });
  const t = Date.parse(String(r?.created ?? '') + (String(r?.created ?? '').endsWith('Z') ? '' : 'Z'));
  if (!Number.isFinite(t)) throw new Error('no created');
  setPermanent('created', account, t);
  return t;
}

async function readCheese(account: string, io: TrustIO): Promise<number> {
  const r = await io.rpc<string[]>('/v1/chain/get_currency_balance', { code: 'cheeseburger', account, symbol: 'CHEESE' });
  if (!Array.isArray(r)) throw new Error('bad balance');
  return r.length ? qty(r[0]) : 0;
}

async function readStake(account: string, io: TrustIO): Promise<number> {
  const r = await io.table<{ staker: string; cheesestaked: string }>({ code: 'cheesecheese', scope: 'cheesecheese', table: 'staketable', lower_bound: account, upper_bound: account, limit: 1 });
  const row = r?.rows?.find(x => x.staker === account);
  return row ? qty(row.cheesestaked) : 0;
}

async function readNfts(account: string, io: TrustIO): Promise<number> {
  const j = await io.nftAccount(account) as { success?: boolean; data?: { collections?: { assets?: unknown; collection?: { collection_name?: string } }[] } };
  if (!j?.success || !Array.isArray(j.data?.collections)) throw new Error('bad response');
  const c = j.data.collections.find(x => x?.collection?.collection_name === 'cheesenftwax');
  return c ? Number(c.assets) || 0 : 0;
}

async function readKey(account: string): Promise<{ published: boolean; firstAt: number | null }> {
  const known = getPermanent('firstKey', account);
  const [current, firstAt] = await Promise.all([
    lookupPublishedKey(account),
    known != null ? Promise.resolve(known) : lookupFirstKeyTime(account),
  ]);
  if (known == null) setPermanent('firstKey', account, firstAt);
  return { published: !!current, firstAt: current ? firstAt : null };
}

export async function loadTrustSignals(account: string): Promise<TrustSignals> {
  const route = await resolveRespectRoute();
  // A saved helper that is down: those lookups stay unknown (uncached), never go public.
  const blocked = route.kind === 'blocked';
  const io = route.kind === 'tor' ? torTrustIO(route.base) : PUBLIC_IO;
  const alcorIO = route.kind === 'tor' ? { positions: io.alcorPositions, tableRows: io.table } : undefined;
  const routed = <T,>(key: string, ttl: number, read: () => Promise<T>) => blocked ? Promise.resolve(null) : cached(key, ttl, read);
  const needsAge = getPermanent('created', account) == null && !peek(`age:${account}`);
  const needsNetwork = needsAge || ['cheese', 'stake', 'pool', 'nft'].some(k => !peek(`${k}:${account}`));
  if (!blocked && needsNetwork && chaffEnabled && !chaffing.has(account) && !inflight.has(`cheese:${account}`)) {
    const decoy = pickDecoy(account, snapshotAccounts());
    if (decoy) {
      chaffing.add(account);
      const gap = jitterMs();
      const go = () => decoyReads(decoy, io, alcorIO, needsAge).finally(() => chaffing.delete(account));
      // Random order: sometimes the decoy goes first and the real lookup follows after a jitter.
      if (Math.random() < 0.5) { void go(); await sleep(gap); } else { setTimeout(() => { void go(); }, gap); }
    }
  }
  const [createdAt, cheese, staked, pooled, nfts, key] = await Promise.all([
    blocked && getPermanent('created', account) != null ? Promise.resolve(getPermanent('created', account)) : routed(`age:${account}`, DAY_MS, () => readCreated(account, io)),
    routed(`cheese:${account}`, DAY_MS, () => readCheese(account, io)),
    routed(`stake:${account}`, DAY_MS, () => readStake(account, io)),
    routed(`pool:${account}`, DAY_MS, () => fetchAlcorCheese(account, alcorIO)),
    routed(`nft:${account}`, DAY_MS, () => readNfts(account, io)),
    cached(`key:${account}`, DAY_MS, () => readKey(account)),
  ]);
  return { account, createdAt, cheese, staked, pooled, nfts, key };
}

/** Only hydrate a full, unexpired snapshot; cached failures stay null/partial. */
export function getCachedTrustSignals(account: string): TrustSignals | null {
  if (!account) return null;
  const keys = ['age', 'cheese', 'stake', 'pool', 'nft', 'key'];
  const entries = keys.map(key => {
    if (key === 'age') {
      const known = getPermanent('created', account);
      if (known != null) return { expiresAt: Infinity, value: known };
    }
    return peek(`${key}:${account}`);
  });
  if (entries.some(entry => !entry || Date.now() >= entry.expiresAt)) return null;
  return {
    account,
    createdAt: entries[0]?.value as TrustSignals['createdAt'],
    cheese: entries[1]?.value as TrustSignals['cheese'],
    staked: entries[2]?.value as TrustSignals['staked'],
    pooled: entries[3]?.value as TrustSignals['pooled'],
    nfts: entries[4]?.value as TrustSignals['nfts'],
    key: entries[5]?.value as TrustSignals['key'],
  };
}

/** Reuse cached signals synchronously; read only when the badge is on screen. */
export function useCryptTrust(account: string, enabled: boolean) {
  const [signals, setSignals] = useState<TrustSignals | null>(() => getCachedTrustSignals(account));
  useEffect(() => {
    if (!enabled || !account) return;
    let live = true;
    const hit = getCachedTrustSignals(account);
    if (hit) { setSignals(hit); return; }
    void loadTrustSignals(account).then(s => { if (live) setSignals(s); });
    return () => { live = false; };
  }, [account, enabled]);
  return signals?.account === account ? signals : getCachedTrustSignals(account);
}
