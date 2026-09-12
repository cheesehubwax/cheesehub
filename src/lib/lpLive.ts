// CHEESEAnal — live read of the CHEESE pools on Alcor, Taco and Defibox.
//
// The daily snapshots (see scripts/lp-history) power the charts; this read powers
// the "today" figures so the page is useful before/between recorded days.
import {
  alcorCheesePairs,
  alcorPairVolume,
  buildPoolSnapshot,
  poolsForPair,
  selectVenuePairs,
  utcDay,
  venuePair,
  type LpDayFile,
  type LpPoolSnapshot,
  type LpVenue,
  type RawPool,
  type RawPosition,
} from './lpPools';
import {
  cheeseUsdFrom,
  fetchUsdPrices,
  priceKey,
  snapshotAmmVenue,
  type UsdPrices,
} from './lpVenues';

const ALCOR_API = 'https://wax.alcor.exchange/api/v2';
const TIMEOUT_MS = 20_000;

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ALCOR_API}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Alcor request failed (${res.status})`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Alcor half of the live read: every recorded CHEESE pair, all fee tiers. */
async function readAlcor(prices: UsdPrices): Promise<{ pools: LpPoolSnapshot[]; failed: string[] }> {
  const allPools = await fetchJson<RawPool[]>('/swap/pools');
  const selected = selectVenuePairs(alcorCheesePairs(allPools));
  const pools: LpPoolSnapshot[] = [];
  const failed: string[] = [];
  const cheeseUsd = cheeseUsdFrom(prices);

  await Promise.all(
    selected.map(async ({ pair }) => {
      const tiers = poolsForPair(allPools, pair);
      if (tiers.length === 0) return;
      const results = await Promise.allSettled(
        tiers.map((pool) => fetchJson<RawPosition[]>(`/swap/pools/${pool.id}/positions`)),
      );
      if (results.some((r) => r.status === 'rejected')) {
        failed.push(`Alcor ${pair.label}`);
        return;
      }
      const withPositions = tiers.map((pool, i) => ({
        pool,
        positions: (results[i] as PromiseFulfilledResult<RawPosition[]>).value ?? [],
      }));
      const snapshot = buildPoolSnapshot(venuePair('alcor', pair), withPositions, {
        cheeseUsd,
        pairedUsd: prices.get(priceKey(pair.symbol, pair.contract)),
      });
      if (snapshot.accounts > 0) pools.push(snapshot);
    }),
  );

  return { pools, failed };
}

/**
 * Current state of every CHEESE pool across the three venues. A venue that
 * cannot be read is reported in `failed` and left out entirely, so an outage
 * never shows up as zero liquidity.
 */
export async function fetchLiveLpSnapshot(): Promise<LpDayFile & { failed: string[] }> {
  let prices: UsdPrices = new Map();
  try {
    prices = await fetchUsdPrices();
  } catch {
    // Prices only affect USD valuation on Taco/Defibox and the price series.
  }

  const failed: string[] = [];
  const partial: LpVenue[] = [];
  const pools: LpPoolSnapshot[] = [];

  const [alcor, taco, defibox] = await Promise.allSettled([
    readAlcor(prices),
    snapshotAmmVenue('taco', prices),
    snapshotAmmVenue('defibox', prices),
  ]);

  if (alcor.status === 'fulfilled') {
    pools.push(...alcor.value.pools);
    failed.push(...alcor.value.failed);
  } else {
    failed.push('Alcor');
    partial.push('alcor');
  }
  if (taco.status === 'fulfilled') pools.push(...taco.value);
  else {
    failed.push('Taco');
    partial.push('taco');
  }
  if (defibox.status === 'fulfilled') pools.push(...defibox.value);
  else {
    failed.push('Defibox');
    partial.push('defibox');
  }

  pools.sort((a, b) => b.usd - a.usd || a.key.localeCompare(b.key));

  const now = Date.now();
  const cheeseUsd = cheeseUsdFrom(prices);
  return {
    date: utcDay(now),
    t: now,
    ...(cheeseUsd !== undefined ? { cheeseUsd } : {}),
    pools,
    ...(partial.length ? { partial } : {}),
    failed,
  };
}
