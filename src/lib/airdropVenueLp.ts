// CHEESEAir — liquidity-provider snapshots across every WAX venue CheeseHub
// tracks: Alcor (concentrated liquidity), Taco and Defibox (constant product).
//
// Alcor positions come from Alcor's own API (see `airdropAlcorLp.ts`). Taco and
// Defibox pools are plain share-token pools, so a provider's stake is their
// share balance divided by the pool's share supply, valued against the pool's
// USD reserves. Weights are therefore directly comparable across venues.
import type { Holder } from './airdropChain';
import {
  fetchAlcorPairs,
  getAlcorLpHolders,
  type AlcorPair,
  type LpHolderSnapshot,
} from './airdropAlcorLp';
import {
  fetchAllAmmPools,
  fetchShareHolders,
  fetchUsdPrices,
  priceKey,
  type AnyAmmPool,
  type UsdPrices,
} from './lpVenues';
import { LP_VENUE_LABELS, type LpVenue } from './lpPools';

const PAIRS_TTL_MS = 5 * 60 * 1000;

/** A pair on one venue, as offered by the CHEESEAir snapshot picker. */
export interface VenueLpPair {
  venue: LpVenue;
  /** Unique across venues: `${venue}:${tokenIdA}|${tokenIdB}`. */
  key: string;
  symbolA: string;
  contractA: string;
  symbolB: string;
  contractB: string;
  tvlUSD: number;
  /** Alcor only — fee tiers of the pools behind this pair. */
  fees?: number[];
  /** Alcor only — the underlying pair record. */
  alcor?: AlcorPair;
  /** Taco / Defibox only — the share pools behind this pair. */
  pools?: { pool: AnyAmmPool; usd: number }[];
}

function tokenId(symbol: string, contract: string): string {
  return `${symbol.toUpperCase()}-${contract}`;
}

function legUsd(prices: UsdPrices, symbol: string, contract: string): number | undefined {
  const value = prices.get(priceKey(symbol, contract));
  return value && value > 0 ? value : undefined;
}

/** USD value of a pool: both legs when priced, otherwise one leg doubled. */
function poolUsdValue(pool: AnyAmmPool, prices: UsdPrices): number {
  const a = legUsd(prices, pool.symbolA, pool.contractA);
  const b = legUsd(prices, pool.symbolB, pool.contractB);
  if (a && b) return pool.reserveA * a + pool.reserveB * b;
  if (a) return pool.reserveA * a * 2;
  if (b) return pool.reserveB * b * 2;
  return 0;
}

function ammPairs(pools: AnyAmmPool[], prices: UsdPrices): VenueLpPair[] {
  const byPair = new Map<string, VenueLpPair>();
  for (const pool of pools) {
    // Normalise direction so A/B and B/A collapse into one pair.
    const flip = tokenId(pool.symbolA, pool.contractA) > tokenId(pool.symbolB, pool.contractB);
    const first = flip
      ? { symbol: pool.symbolB, contract: pool.contractB }
      : { symbol: pool.symbolA, contract: pool.contractA };
    const second = flip
      ? { symbol: pool.symbolA, contract: pool.contractA }
      : { symbol: pool.symbolB, contract: pool.contractB };
    const key =
      `${pool.venue}:${tokenId(first.symbol, first.contract)}|` +
      `${tokenId(second.symbol, second.contract)}`;
    const usd = poolUsdValue(pool, prices);

    const existing = byPair.get(key);
    if (existing) {
      existing.tvlUSD += usd;
      existing.pools?.push({ pool, usd });
      continue;
    }
    byPair.set(key, {
      venue: pool.venue,
      key,
      symbolA: first.symbol,
      contractA: first.contract,
      symbolB: second.symbol,
      contractB: second.contract,
      tvlUSD: usd,
      pools: [{ pool, usd }],
    });
  }
  return [...byPair.values()];
}

function alcorAsVenuePairs(pairs: AlcorPair[]): VenueLpPair[] {
  return pairs.map((pair) => ({
    venue: 'alcor' as const,
    key: `alcor:${pair.key}`,
    symbolA: pair.symbolA,
    contractA: pair.contractA,
    symbolB: pair.symbolB,
    contractB: pair.contractB,
    tvlUSD: pair.tvlUSD,
    fees: pair.fees,
    alcor: pair,
  }));
}

let pairsCache: { data: VenueLpPair[]; at: number } | null = null;

/**
 * Every pair CHEESEAir can snapshot, across all three venues, sorted by TVL.
 * A venue that fails to answer is simply left out rather than failing the whole
 * picker — Alcor alone still gives a usable list.
 */
export async function fetchVenueLpPairs(): Promise<VenueLpPair[]> {
  if (pairsCache && Date.now() - pairsCache.at < PAIRS_TTL_MS) return pairsCache.data;

  const [alcorResult, pricesResult] = await Promise.allSettled([
    fetchAlcorPairs(),
    fetchUsdPrices(),
  ]);

  const out: VenueLpPair[] = [];
  if (alcorResult.status === 'fulfilled') out.push(...alcorAsVenuePairs(alcorResult.value));

  if (pricesResult.status === 'fulfilled') {
    const prices = pricesResult.value;
    const amm = await Promise.allSettled([
      fetchAllAmmPools('taco'),
      fetchAllAmmPools('defibox'),
    ]);
    for (const result of amm) {
      if (result.status !== 'fulfilled') continue;
      out.push(...ammPairs(result.value, prices));
    }
  }

  if (out.length === 0) throw new Error('No liquidity venues answered — try again shortly');

  const sorted = out.sort((x, y) => y.tvlUSD - x.tvlUSD);
  pairsCache = { data: sorted, at: Date.now() };
  return sorted;
}

/** "CHEESE / WAX" — the venue is shown separately as a badge. */
export function venuePairLabel(pair: VenueLpPair): string {
  return `${pair.symbolA} / ${pair.symbolB}`;
}

export function venueLabel(venue: LpVenue): string {
  return LP_VENUE_LABELS[venue] ?? venue;
}

/** Case-insensitive match on either symbol, the label, a contract, or a venue. */
export function filterVenuePairs(pairs: VenueLpPair[], query: string, limit = 60): VenueLpPair[] {
  const q = query.trim().toLowerCase();
  if (!q) return pairs.slice(0, limit);
  const out: VenueLpPair[] = [];
  for (const p of pairs) {
    const haystack =
      `${p.symbolA} ${p.symbolB} ${p.symbolA}/${p.symbolB} ` +
      `${p.contractA} ${p.contractB} ${venueLabel(p.venue)}`;
    if (haystack.toLowerCase().includes(q)) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Providers of one Taco / Defibox pair, weighted by the USD value of their
 * share of every pool of that pair. When no leg of a pool has a USD price the
 * first reserve is used as the unit instead — still proportional within a pair,
 * so pro-rata splits stay correct even for unpriced tokens.
 */
async function getAmmLpHolders(pair: VenueLpPair): Promise<LpHolderSnapshot> {
  const pools = pair.pools ?? [];
  if (pools.length === 0) throw new Error(`No pools found for ${venuePairLabel(pair)}`);

  const weightByAccount = new Map<string, number>();
  let poolsScanned = 0;
  let positions = 0;
  let priced = true;
  let lastError: unknown = null;

  for (const { pool, usd } of pools) {
    let holders;
    try {
      holders = await fetchShareHolders(pool.shareContract, pool.shareSymbol);
    } catch (error) {
      lastError = error;
      continue;
    }
    poolsScanned += 1;
    const unit = usd > 0 ? usd : pool.reserveA;
    if (!(usd > 0)) priced = false;
    for (const holder of holders) {
      if (!(holder.shares > 0)) continue;
      const value = (holder.shares / pool.totalShares) * unit;
      if (!(value > 0)) continue;
      positions += 1;
      weightByAccount.set(holder.account, (weightByAccount.get(holder.account) ?? 0) + value);
    }
  }

  if (poolsScanned === 0) {
    throw new Error(
      lastError instanceof Error
        ? lastError.message
        : `${venueLabel(pair.venue)} providers unavailable`,
    );
  }

  const holders: Holder[] = [...weightByAccount.entries()]
    .map(([account, weight]) => ({
      account,
      weight,
      raw: priced ? formatUsd(weight) : `${weight.toFixed(4)} ${pair.symbolA}`,
    }))
    .sort((a, b) => b.weight - a.weight);

  if (holders.length === 0) {
    throw new Error(`No liquidity providers found for ${venuePairLabel(pair)}`);
  }

  return {
    holders,
    truncated: false,
    source: `${pair.venue}-lp`,
    hasBalances: true,
    poolsScanned,
    positions,
  };
}

/** Providers of one pair on whichever venue it belongs to. */
export async function getVenueLpHolders(pair: VenueLpPair): Promise<LpHolderSnapshot> {
  if (pair.venue === 'alcor') {
    if (!pair.alcor) throw new Error('Alcor pair details missing — reload the pair list');
    return getAlcorLpHolders(pair.alcor);
  }
  return getAmmLpHolders(pair);
}
