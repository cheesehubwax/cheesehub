// CHEESEAnal — live read of the tracked CHEESE pools straight from Alcor.
//
// The daily snapshots (see scripts/lp-history) power the charts; this read powers
// the "today" figures so the page is useful before/between recorded days.
import {
  TRACKED_LP_PAIRS,
  buildPoolSnapshot,
  poolsForPair,
  utcDay,
  type LpDayFile,
  type LpPoolSnapshot,
  type RawPool,
  type RawPosition,
} from './lpPools';

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

/**
 * Current state of every tracked pair. Pools that fail to read are omitted and
 * reported in `failed`, so a single flaky tier never shows up as zero liquidity.
 */
export async function fetchLiveLpSnapshot(): Promise<LpDayFile & { failed: string[] }> {
  const allPools = await fetchJson<RawPool[]>('/swap/pools');
  const pools: LpPoolSnapshot[] = [];
  const failed: string[] = [];

  await Promise.all(
    TRACKED_LP_PAIRS.map(async (target) => {
      const tiers = poolsForPair(allPools, target);
      if (tiers.length === 0) {
        failed.push(target.label);
        return;
      }
      const results = await Promise.allSettled(
        tiers.map((pool) => fetchJson<RawPosition[]>(`/swap/pools/${pool.id}/positions`)),
      );
      if (results.some((r) => r.status === 'rejected')) {
        failed.push(target.label);
        return;
      }
      const withPositions = tiers.map((pool, i) => ({
        pool,
        positions: (results[i] as PromiseFulfilledResult<RawPosition[]>).value ?? [],
      }));
      pools.push(buildPoolSnapshot(target, withPositions));
    }),
  );

  const order = new Map(TRACKED_LP_PAIRS.map((p, i) => [p.key, i]));
  pools.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));

  const now = Date.now();
  return { date: utcDay(now), t: now, pools, failed };
}
