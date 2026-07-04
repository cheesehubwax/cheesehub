// Alcor swap SDK adapter — SHADOW MODE.
// Fetches all pools + on-demand tick data, runs the same client-side smart
// order router Alcor's own UI uses, and returns a split trade for parity
// comparison against the public HTTP /swapRouter/getRoute endpoint.
//
// This module does NOT yet mutate the executed transaction. See the plan:
// once shadow-mode logs show parity vs. Alcor's UI, we'll wire the split
// output into normalizeRouteActions (one transfer per split).

import {
  Pool,
  Token,
  Trade,
  CurrencyAmount,
  computeAllRoutes,
  TradeType,
} from "@alcorexchange/alcor-swap-sdk";
import type { SwapToken } from "./swapApi";
import { logger } from "./logger";

const ALCOR_API = "https://wax.alcor.exchange/api/v2";

// ----- Raw API shapes -----

interface RawAlcorPool {
  id: number;
  active: boolean;
  fee: number;
  tickSpacing: number;
  sqrtPriceX64: string;
  liquidity: string;
  tick: number;
  feeGrowthGlobalAX64: string;
  feeGrowthGlobalBX64: string;
  tokenA: { contract: string; decimals: number; symbol: string; id: string };
  tokenB: { contract: string; decimals: number; symbol: string; id: string };
}

interface RawAlcorTick {
  id: number;
  liquidityGross: string | number;
  liquidityNet: string | number;
  feeGrowthOutsideAX64: string;
  feeGrowthOutsideBX64: string;
  tickCumulativeOutside: number | string;
  secondsPerLiquidityOutsideX64: string;
  secondsOutside: number | string;
  initialized?: number | boolean;
}

// ----- Cached fetchers -----

let poolsCache: { at: number; data: RawAlcorPool[] } | null = null;
let poolsInflight: Promise<RawAlcorPool[]> | null = null;
const POOLS_TTL_MS = 30_000;

export async function fetchAllAlcorPools(signal?: AbortSignal): Promise<RawAlcorPool[]> {
  if (poolsCache && Date.now() - poolsCache.at < POOLS_TTL_MS) return poolsCache.data;
  if (poolsInflight) return poolsInflight;
  poolsInflight = (async () => {
    const res = await fetch(`${ALCOR_API}/swap/pools`, { signal });
    if (!res.ok) throw new Error(`Failed to fetch Alcor pools (${res.status})`);
    const data = (await res.json()) as RawAlcorPool[];
    poolsCache = { at: Date.now(), data };
    return data;
  })();
  try {
    return await poolsInflight;
  } finally {
    poolsInflight = null;
  }
}

const ticksCache = new Map<number, { at: number; data: RawAlcorTick[] }>();
const ticksInflight = new Map<number, Promise<RawAlcorTick[]>>();
const TICKS_TTL_MS = 30_000;

export async function fetchPoolTicks(poolId: number, signal?: AbortSignal): Promise<RawAlcorTick[]> {
  const cached = ticksCache.get(poolId);
  if (cached && Date.now() - cached.at < TICKS_TTL_MS) return cached.data;
  const inflight = ticksInflight.get(poolId);
  if (inflight) return inflight;
  const p = (async () => {
    const res = await fetch(`${ALCOR_API}/swap/pools/${poolId}/ticks`, { signal });
    if (!res.ok) throw new Error(`Failed to fetch ticks for pool ${poolId} (${res.status})`);
    const data = (await res.json()) as RawAlcorTick[];
    ticksCache.set(poolId, { at: Date.now(), data });
    return data;
  })();
  ticksInflight.set(poolId, p);
  try {
    return await p;
  } finally {
    ticksInflight.delete(poolId);
  }
}

// ----- Route graph filtering -----

function tokenKey(contract: string, symbol: string): string {
  return `${symbol.toLowerCase()}-${contract}`;
}

/** BFS the pool graph from tokenIn to find every pool reachable within maxHops
 *  that could plausibly be part of a route ending at tokenOut. */
function selectRelevantPools(
  pools: RawAlcorPool[],
  inKey: string,
  outKey: string,
  maxHops: number
): RawAlcorPool[] {
  // Build adjacency: token -> [poolIndex,...]
  const adj = new Map<string, number[]>();
  const keyOf = (t: RawAlcorPool["tokenA"]) => tokenKey(t.contract, t.symbol);
  pools.forEach((p, i) => {
    if (!p.active) return;
    const a = keyOf(p.tokenA);
    const b = keyOf(p.tokenB);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(i);
    adj.get(b)!.push(i);
  });

  // Distance from tokenIn (in hops), and distance from tokenOut.
  const distFrom = (start: string): Map<string, number> => {
    const dist = new Map<string, number>();
    dist.set(start, 0);
    let frontier = [start];
    for (let h = 0; h < maxHops && frontier.length; h++) {
      const next: string[] = [];
      for (const t of frontier) {
        const cur = dist.get(t)!;
        for (const pi of adj.get(t) ?? []) {
          const p = pools[pi];
          const other = keyOf(p.tokenA) === t ? keyOf(p.tokenB) : keyOf(p.tokenA);
          if (!dist.has(other)) {
            dist.set(other, cur + 1);
            next.push(other);
          }
        }
      }
      frontier = next;
    }
    return dist;
  };

  const dIn = distFrom(inKey);
  const dOut = distFrom(outKey);
  if (!dIn.has(outKey)) return []; // no route reachable

  // Keep pools whose endpoint distances sum to <= maxHops.
  const keep: RawAlcorPool[] = [];
  for (const p of pools) {
    if (!p.active) continue;
    const a = keyOf(p.tokenA);
    const b = keyOf(p.tokenB);
    const da = dIn.get(a);
    const db = dOut.get(b);
    const da2 = dIn.get(b);
    const db2 = dOut.get(a);
    const opt1 = da !== undefined && db !== undefined ? da + 1 + db : Infinity;
    const opt2 = da2 !== undefined && db2 !== undefined ? da2 + 1 + db2 : Infinity;
    if (Math.min(opt1, opt2) <= maxHops) keep.push(p);
  }
  return keep;
}

// ----- Pool construction -----

function buildPool(raw: RawAlcorPool, ticks: RawAlcorTick[]): Pool {
  // Match the exact JSON shape Pool.fromJSON expects. The tick shape from
  // /pools/:id/ticks already matches Tick.fromJSON.
  const json = {
    id: raw.id,
    active: raw.active,
    fee: raw.fee,
    tokenA: { contract: raw.tokenA.contract, decimals: raw.tokenA.decimals, symbol: raw.tokenA.symbol },
    tokenB: { contract: raw.tokenB.contract, decimals: raw.tokenB.decimals, symbol: raw.tokenB.symbol },
    sqrtPriceX64: raw.sqrtPriceX64,
    liquidity: raw.liquidity,
    tickCurrent: raw.tick,
    feeGrowthGlobalAX64: raw.feeGrowthGlobalAX64,
    feeGrowthGlobalBX64: raw.feeGrowthGlobalBX64,
    tickDataProvider: ticks
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((t) => ({
        id: t.id,
        liquidityGross: String(t.liquidityGross),
        liquidityNet: String(t.liquidityNet),
        feeGrowthOutsideAX64: t.feeGrowthOutsideAX64,
        feeGrowthOutsideBX64: t.feeGrowthOutsideBX64,
        tickCumulativeOutside: String(t.tickCumulativeOutside),
        secondsPerLiquidityOutsideX64: t.secondsPerLiquidityOutsideX64,
        secondsOutside: String(t.secondsOutside),
      })),
  };
  return Pool.fromJSON(json);
}

// ----- Public entry -----

export interface ShadowSplit {
  percent: number;
  poolIds: number[];
  path: string[]; // token symbols along the route
  inputAmount: string;
  outputAmount: string;
}

export interface ShadowQuote {
  totalInput: string;
  totalOutput: string;
  priceImpact: string;
  splits: ShadowSplit[];
  routesConsidered: number;
  poolsFetched: number;
  tookMs: number;
}

export interface ShadowQuoteArgs {
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  amount: string;
  tradeType: "EXACT_INPUT" | "EXACT_OUTPUT";
  maxHops?: number;
  distributionPercent?: number;
  signal?: AbortSignal;
}

export async function computeShadowQuote(args: ShadowQuoteArgs): Promise<ShadowQuote | null> {
  const {
    tokenIn,
    tokenOut,
    amount,
    tradeType,
    maxHops = 3,
    distributionPercent = 5,
    signal,
  } = args;

  const started = performance.now();
  const inKey = tokenKey(tokenIn.contract, tokenIn.ticker);
  const outKey = tokenKey(tokenOut.contract, tokenOut.ticker);

  const allPools = await fetchAllAlcorPools(signal);
  const relevant = selectRelevantPools(allPools, inKey, outKey, maxHops);
  if (relevant.length === 0) return null;

  // Fetch ticks for every relevant pool in parallel.
  const tickResults = await Promise.all(
    relevant.map(async (p) => {
      try {
        return { p, ticks: await fetchPoolTicks(p.id, signal) };
      } catch (e) {
        logger.warn(`shadow: tick fetch failed for pool ${p.id}`, e);
        return { p, ticks: [] as RawAlcorTick[] };
      }
    })
  );

  const sdkPools = tickResults
    .filter((r) => r.ticks.length > 0)
    .map((r) => {
      try {
        return buildPool(r.p, r.ticks);
      } catch (e) {
        logger.warn(`shadow: pool build failed for pool ${r.p.id}`, e);
        return null;
      }
    })
    .filter((p): p is Pool => p !== null);

  if (sdkPools.length === 0) return null;

  const inTok = new Token(tokenIn.contract, tokenIn.precision, tokenIn.ticker);
  const outTok = new Token(tokenOut.contract, tokenOut.precision, tokenOut.ticker);

  const routes = computeAllRoutes(inTok, outTok, sdkPools, maxHops);
  if (routes.length === 0) return null;

  // Build percent grid: [distributionPercent, 2*d, ..., 100].
  const percents: number[] = [];
  for (let p = distributionPercent; p <= 100; p += distributionPercent) percents.push(p);

  const rawAmount = toRawAmount(amount, tradeType === "EXACT_INPUT" ? tokenIn.precision : tokenOut.precision);
  const currencyAmount = CurrencyAmount.fromRawAmount(
    tradeType === "EXACT_INPUT" ? inTok : outTok,
    rawAmount
  );

  const trade = (Trade as any).bestTradeWithSplit(
    routes,
    currencyAmount,
    percents,
    tradeType === "EXACT_INPUT" ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT,
    { minSplits: 1, maxSplits: 4 }
  );
  if (!trade) return null;

  const splits: ShadowSplit[] = trade.swaps.map((s: any) => ({
    percent: s.percent,
    poolIds: s.route.pools.map((p: Pool) => p.id),
    path: s.route.tokenPath.map((t: Token) => t.symbol),
    inputAmount: s.inputAmount.toFixed(),
    outputAmount: s.outputAmount.toFixed(),
  }));

  return {
    totalInput: trade.inputAmount.toFixed(),
    totalOutput: trade.outputAmount.toFixed(),
    priceImpact: trade.priceImpact.toFixed(4),
    splits,
    routesConsidered: routes.length,
    poolsFetched: sdkPools.length,
    tookMs: Math.round(performance.now() - started),
  };
}

function toRawAmount(human: string, decimals: number): string {
  // Convert "1.23" @ decimals=8 → "123000000". Avoids float precision.
  const [whole, frac = ""] = human.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const raw = (whole || "0") + fracPadded;
  const trimmed = raw.replace(/^0+(?=\d)/, "");
  return trimmed || "0";
}
