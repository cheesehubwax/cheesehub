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
  Percent,
} from "@alcorexchange/alcor-swap-sdk";
import type { SwapToken, SwapRoute, SwapSplit } from "./swapApi";
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
  // Optional volume field — some /swap/pools responses include it. Used for
  // ranking when we need to cap the candidate set.
  volumeUSD24?: number | string;
  volumeUSDWeek?: number | string;
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

/**
 * Select every active pool that lies on at least one tokenIn → tokenOut path
 * of length ≤ `maxHops`. Uses forward BFS from tokenIn and reverse BFS from
 * tokenOut over the FULL pool graph (no hub-token allowlist) so we discover
 * the same set of routes Alcor's own UI feeds to `computeAllRoutes`.
 *
 * Cap semantics: pools directly touching tokenIn or tokenOut are always kept.
 * Only deeper intermediate-only pools are ranked and capped, using
 * volumeUSD24 (when the API provides it) with log-scale liquidity as a
 * tiebreaker.
 */
function selectRelevantPools(
  pools: RawAlcorPool[],
  inKey: string,
  outKey: string,
  maxHops: number,
  cap = 60
): RawAlcorPool[] {
  const keyOf = (t: RawAlcorPool["tokenA"]) => tokenKey(t.contract, t.symbol);
  // Drop inactive and zero-liquidity pools before graph construction: they
  // can never contribute an output but would still cost us a /ticks fetch.
  const active = pools.filter((p) => {
    if (!p.active) return false;
    try {
      return BigInt(p.liquidity || "0") > 0n;
    } catch {
      return false;
    }
  });

  // Build full-graph adjacency.
  const adj = new Map<string, RawAlcorPool[]>();
  for (const p of active) {
    for (const k of [keyOf(p.tokenA), keyOf(p.tokenB)]) {
      let arr = adj.get(k);
      if (!arr) {
        arr = [];
        adj.set(k, arr);
      }
      arr.push(p);
    }
  }

  const bfs = (start: string, limit: number): Map<string, number> => {
    const dist = new Map<string, number>([[start, 0]]);
    let frontier = [start];
    for (let h = 0; h < limit && frontier.length; h++) {
      const next: string[] = [];
      for (const t of frontier) {
        const d = dist.get(t)!;
        for (const p of adj.get(t) ?? []) {
          const o = keyOf(p.tokenA) === t ? keyOf(p.tokenB) : keyOf(p.tokenA);
          if (!dist.has(o)) {
            dist.set(o, d + 1);
            next.push(o);
          }
        }
      }
      frontier = next;
    }
    return dist;
  };

  const dIn = bfs(inKey, maxHops);
  const dOut = bfs(outKey, maxHops);
  if (!dIn.has(outKey)) return [];

  // A pool (a,b) lies on a ≤maxHops in→out path iff
  //   dIn(a) + 1 + dOut(b) ≤ maxHops  OR  dIn(b) + 1 + dOut(a) ≤ maxHops.
  const onPath = (p: RawAlcorPool): boolean => {
    const a = keyOf(p.tokenA);
    const b = keyOf(p.tokenB);
    const da = dIn.get(a);
    const db = dIn.get(b);
    const ea = dOut.get(a);
    const eb = dOut.get(b);
    if (da !== undefined && eb !== undefined && da + 1 + eb <= maxHops) return true;
    if (db !== undefined && ea !== undefined && db + 1 + ea <= maxHops) return true;
    return false;
  };

  const candidates = active.filter(onPath);

  // Split into direct-hop pools (always kept) and deeper intermediate-only
  // pools (ranked + capped).
  const direct: RawAlcorPool[] = [];
  const deep: RawAlcorPool[] = [];
  for (const p of candidates) {
    const a = keyOf(p.tokenA);
    const b = keyOf(p.tokenB);
    if (a === inKey || b === inKey || a === outKey || b === outKey) direct.push(p);
    else deep.push(p);
  }

  if (direct.length + deep.length <= cap) return [...direct, ...deep];

  const num = (v: number | string | undefined): number => {
    if (v === undefined || v === null) return 0;
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const rank = (p: RawAlcorPool): number => {
    const vol = num(p.volumeUSD24) || num(p.volumeUSDWeek) / 7;
    if (vol > 0) return vol;
    // Log-scale fallback so mismatched decimal scales don't dominate.
    try {
      const l = BigInt(p.liquidity || "0");
      return l > 0n ? Math.log10(Number(l)) : 0;
    } catch {
      return 0;
    }
  };
  deep.sort((a, b) => rank(b) - rank(a));
  const room = Math.max(0, cap - direct.length);
  return [...direct, ...deep.slice(0, room)];
}

/**
 * Lightweight concurrency limiter. Keeps tick fanout well under the
 * /pools/:id/ticks rate limit while still parallelising.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, worker));
  return results;
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

  logger.info(`[shadow-router] pools selected: ${relevant.length}`);

  // Fetch ticks in parallel, capped concurrency to respect rate limits.
  const tickResults = await mapLimit(relevant, 8, async (p) => {
    try {
      return { p, ticks: await fetchPoolTicks(p.id, signal) };
    } catch (e) {
      logger.warn(`shadow: tick fetch failed for pool ${p.id}`, e);
      return { p, ticks: [] as RawAlcorTick[] };
    }
  });

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

// ----- Split-trade -> SwapRoute adapter -----

export interface AlcorTradeArgs {
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  amount: string;
  slippage: number; // percent (e.g. 1 = 1%)
  receiver: string;
  tradeType: "EXACT_INPUT" | "EXACT_OUTPUT";
  maxHops?: number;
  distributionPercent?: number;
  signal?: AbortSignal;
}

/**
 * Runs the Alcor SDK smart order router and returns a SwapRoute in the exact
 * shape the widget already consumes, INCLUDING per-split memos for multi-
 * transfer execution. Returns null when no route is found (caller should fall
 * back to the HTTP endpoint).
 */
export async function computeAlcorTrade(args: AlcorTradeArgs): Promise<SwapRoute | null> {
  const {
    tokenIn,
    tokenOut,
    amount,
    slippage,
    receiver,
    tradeType,
    maxHops = 3,
    distributionPercent = 5,
    signal,
  } = args;

  const inKey = tokenKey(tokenIn.contract, tokenIn.ticker);
  const outKey = tokenKey(tokenOut.contract, tokenOut.ticker);

  const allPools = await fetchAllAlcorPools(signal);
  const relevant = selectRelevantPools(allPools, inKey, outKey, maxHops);
  if (relevant.length === 0) return null;

  logger.info(`[alcor-router] pools selected: ${relevant.length}`);

  const tickResults = await mapLimit(relevant, 8, async (p) => {
    try {
      return { p, ticks: await fetchPoolTicks(p.id, signal) };
    } catch (e) {
      logger.warn(`alcorTrade: tick fetch failed for pool ${p.id}`, e);
      return { p, ticks: [] as RawAlcorTick[] };
    }
  });

  const sdkPools = tickResults
    .filter((r) => r.ticks.length > 0)
    .map((r) => {
      try {
        return buildPool(r.p, r.ticks);
      } catch (e) {
        logger.warn(`alcorTrade: pool build failed for pool ${r.p.id}`, e);
        return null;
      }
    })
    .filter((p): p is Pool => p !== null);
  if (sdkPools.length === 0) return null;

  const inTok = new Token(tokenIn.contract, tokenIn.precision, tokenIn.ticker);
  const outTok = new Token(tokenOut.contract, tokenOut.precision, tokenOut.ticker);

  const routes = computeAllRoutes(inTok, outTok, sdkPools, maxHops);
  if (routes.length === 0) return null;

  const percents: number[] = [];
  for (let p = distributionPercent; p <= 100; p += distributionPercent) percents.push(p);

  const rawAmount = toRawAmount(
    amount,
    tradeType === "EXACT_INPUT" ? tokenIn.precision : tokenOut.precision
  );
  const currencyAmount = CurrencyAmount.fromRawAmount(
    tradeType === "EXACT_INPUT" ? inTok : outTok,
    rawAmount
  );

  const sdkTradeType = tradeType === "EXACT_INPUT" ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT;
  const trade = (Trade as any).bestTradeWithSplit(
    routes,
    currencyAmount,
    percents,
    sdkTradeType,
    { minSplits: 1, maxSplits: 4 }
  );
  if (!trade) return null;

  // Slippage as SDK Percent: e.g. 1% => Percent(100, 10_000).
  const bps = Math.round(slippage * 100); // 1% -> 100bps
  const slip = new Percent(bps, 10_000);

  const exactIn = tradeType === "EXACT_INPUT";
  const opWord = exactIn ? "swapexactin" : "swapexactout";

  // Per-split shape mirrors Alcor's own parseTrade so the memo is byte-identical
  // to what wax.alcor.exchange sends today.
  const splits: SwapSplit[] = trade.swaps.map((s: any) => {
    const poolIds: number[] = s.route.pools.map((p: Pool) => p.id);
    const maxSent = exactIn ? s.inputAmount : trade.maximumAmountIn(slip, s.inputAmount);
    const minReceived = exactIn ? trade.minimumAmountOut(slip, s.outputAmount) : s.outputAmount;
    const memo = `${opWord}#${poolIds.join(",")}#${receiver}#${minReceived.toExtendedAsset()}#0`;
    return {
      percent: s.percent,
      route: poolIds,
      input: s.inputAmount.toFixed(),
      output: s.outputAmount.toFixed(),
      minReceived: minReceived.toFixed(),
      maxSent: maxSent.toFixed(),
      memo,
    };
  });

  const aggMin = exactIn ? trade.minimumAmountOut(slip) : trade.outputAmount;
  const aggRoute: number[] = trade.swaps[0].route.pools.map((p: Pool) => p.id);
  const aggMemo = `${opWord}#${aggRoute.join(",")}#${receiver}#${aggMin.toExtendedAsset()}#0`;

  return {
    output: parseFloat(trade.outputAmount.toFixed()),
    minReceived: parseFloat(aggMin.toFixed()),
    priceImpact: parseFloat(trade.priceImpact.toFixed(4)),
    memo: aggMemo,
    route: aggRoute,
    executionPrice: {
      numerator: trade.executionPrice.numerator.toString(),
      denominator: trade.executionPrice.denominator.toString(),
    },
    input: parseFloat(trade.inputAmount.toFixed()),
    swaps: splits,
  } as SwapRoute;
}
