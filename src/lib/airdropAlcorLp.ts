// CHEESEAir — snapshot source: liquidity providers of an Alcor pool pair.
//
// Alcor is a concentrated-liquidity DEX: every LP owns one or more positions
// inside a specific pool (pair + fee tier). The on-chain `swap.alcor::positions`
// table is only indexed by position id and by owner, so enumerating a pool's
// providers has to go through Alcor's public API.
import { markAlcorRateLimited } from './alcorRouter';
import type { Holder, HolderSnapshot } from './airdropChain';

const ALCOR_API = 'https://wax.alcor.exchange/api/v2';
const PAIRS_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

export interface AlcorPair {
  /** Stable identifier: `${idA}|${idB}` with token ids sorted. */
  key: string;
  symbolA: string;
  contractA: string;
  symbolB: string;
  contractB: string;
  poolIds: number[];
  /** Fee tiers (in hundredths of a bip) aligned with `poolIds`. */
  fees: number[];
  tvlUSD: number;
}

export interface LpHolderSnapshot extends HolderSnapshot {
  poolsScanned: number;
  positions: number;
}

interface RawPoolToken {
  symbol?: string;
  contract?: string;
}

interface RawPool {
  id: number;
  fee?: number;
  active?: number | boolean;
  tvlUSD?: number;
  tokenA?: RawPoolToken;
  tokenB?: RawPoolToken;
}

interface RawPosition {
  owner?: string;
  liquidity?: string | number;
  closed?: boolean;
  inRange?: boolean;
  depositedUSDTotal?: number;
}

async function fetchAlcorJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${ALCOR_API}${path}`, { signal: controller.signal });
    if (!res.ok) {
      if (res.status === 429) {
        markAlcorRateLimited();
        throw new Error('Alcor rate limited — wait a moment and try again');
      }
      throw new Error(`Alcor request failed (${res.status})`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function tokenId(t: RawPoolToken | undefined): string {
  return `${(t?.symbol ?? '').toUpperCase()}-${t?.contract ?? ''}`;
}

let pairsCache: { data: AlcorPair[]; at: number } | null = null;

/**
 * Every Alcor pair that has at least one pool, aggregated across fee tiers and
 * sorted by total TVL so the most relevant pairs surface first in the picker.
 */
export async function fetchAlcorPairs(): Promise<AlcorPair[]> {
  if (pairsCache && Date.now() - pairsCache.at < PAIRS_TTL_MS) return pairsCache.data;

  const pools = await fetchAlcorJson<RawPool[]>('/swap/pools');
  const byPair = new Map<string, AlcorPair>();

  for (const pool of pools) {
    const a = pool.tokenA;
    const b = pool.tokenB;
    if (!a?.symbol || !b?.symbol || !a.contract || !b.contract) continue;
    if (pool.active === 0 || pool.active === false) continue;

    // Normalise direction so WAX/CHEESE and CHEESE/WAX collapse into one pair.
    const [first, second] = tokenId(a) <= tokenId(b) ? [a, b] : [b, a];
    const key = `${tokenId(first)}|${tokenId(second)}`;

    const existing = byPair.get(key);
    if (existing) {
      existing.poolIds.push(pool.id);
      existing.fees.push(Number(pool.fee ?? 0));
      existing.tvlUSD += Number(pool.tvlUSD ?? 0);
      continue;
    }
    byPair.set(key, {
      key,
      symbolA: (first.symbol ?? '').toUpperCase(),
      contractA: first.contract ?? '',
      symbolB: (second.symbol ?? '').toUpperCase(),
      contractB: second.contract ?? '',
      poolIds: [pool.id],
      fees: [Number(pool.fee ?? 0)],
      tvlUSD: Number(pool.tvlUSD ?? 0),
    });
  }

  const pairs = [...byPair.values()].sort((x, y) => y.tvlUSD - x.tvlUSD);
  pairsCache = { data: pairs, at: Date.now() };
  return pairs;
}

/** Human label used in the picker and the snapshot note. */
export function pairLabel(pair: AlcorPair): string {
  return `${pair.symbolA} / ${pair.symbolB}`;
}

/** Fee tier 3000 → "0.3%". */
export function formatFee(fee: number): string {
  return `${(fee / 10000).toFixed(fee % 10000 === 0 ? 1 : 2)}%`;
}

/** Case-insensitive match on either symbol, the pair label, or a contract. */
export function filterPairs(pairs: AlcorPair[], query: string, limit = 60): AlcorPair[] {
  const q = query.trim().toLowerCase();
  if (!q) return pairs.slice(0, limit);
  const out: AlcorPair[] = [];
  for (const p of pairs) {
    const haystack = `${p.symbolA} ${p.symbolB} ${p.symbolA}/${p.symbolB} ${p.contractA} ${p.contractB}`;
    if (haystack.toLowerCase().includes(q)) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Liquidity providers of every fee tier of one pair, weighted by the USD value
 * of their open, in-range positions. Weights across pools are summed per
 * account, and accounts with no USD value are dropped (they cannot receive a
 * pro-rata share).
 */
export async function getAlcorLpHolders(pair: AlcorPair): Promise<LpHolderSnapshot> {
  const results = await Promise.allSettled(
    pair.poolIds.map((id) => fetchAlcorJson<RawPosition[]>(`/swap/pools/${id}/positions`)),
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  if (succeeded === 0) {
    const first = results.find((r) => r.status === 'rejected') as
      | PromiseRejectedResult
      | undefined;
    throw new Error(
      first?.reason instanceof Error ? first.reason.message : 'Alcor positions unavailable',
    );
  }

  const usdByAccount = new Map<string, number>();
  let positions = 0;

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const pos of result.value) {
      const account = pos.owner ?? '';
      if (!account) continue;
      if (pos.closed === true) continue;
      if (pos.inRange !== true) continue;
      if (!(Number(pos.liquidity ?? 0) > 0)) continue;
      const usd = Number(pos.depositedUSDTotal ?? 0);
      if (!(usd > 0)) continue;
      positions += 1;
      usdByAccount.set(account, (usdByAccount.get(account) ?? 0) + usd);
    }
  }

  const holders: Holder[] = [...usdByAccount.entries()]
    .map(([account, usd]) => ({ account, weight: usd, raw: formatUsd(usd) }))
    .sort((a, b) => b.weight - a.weight);

  if (holders.length === 0) {
    throw new Error(`No in-range liquidity providers found for ${pairLabel(pair)}`);
  }

  return {
    holders,
    truncated: false,
    source: 'alcor-lp',
    hasBalances: true,
    poolsScanned: succeeded,
    positions,
  };
}
