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

// Hub tokens that make good intermediate hops on WAX (matches Alcor's routing
// heuristics: only route through liquid, well-known assets).
const HUB_KEYS = new Set([
  "wax-eosio.token",
  "usdt-usdt.alcor",
  "usdc-usdc.alcor",
  "waxusdc-eth.token",
  "waxusdt-eth.token",
  "usdc-tethertether",
  "lswax-token.lswax",
]);

/** Select pools that could participate in a tokenIn→tokenOut route of length
 *  ≤ maxHops, restricting intermediate tokens to a curated hub set. Also caps
 *  the total pool count by liquidity to avoid overwhelming the ticks endpoint. */
function selectRelevantPools(
  pools: RawAlcorPool[],
  inKey: string,
  outKey: string,
  maxHops: number,
  cap = 60
): RawAlcorPool[] {
  const keyOf = (t: RawAlcorPool["tokenA"]) => tokenKey(t.contract, t.symbol);
  const active = pools.filter((p) => p.active);

  const involves = (p: RawAlcorPool, k: string) => keyOf(p.tokenA) === k || keyOf(p.tokenB) === k;
  const other = (p: RawAlcorPool, k: string) =>
    keyOf(p.tokenA) === k ? keyOf(p.tokenB) : keyOf(p.tokenA);

  // Any pool that could participate in a route: touches tokenIn, tokenOut, or a hub.
  // We then verify each selected pool is on some ≤maxHops path in-code.
  const anchors = new Set<string>([inKey, outKey, ...HUB_KEYS]);
  const candidates = active.filter((p) => anchors.has(keyOf(p.tokenA)) && anchors.has(keyOf(p.tokenB)));

  // Verify connectivity via BFS restricted to `anchors` intermediates.
  const adj = new Map<string, RawAlcorPool[]>();
  for (const p of candidates) {
    for (const k of [keyOf(p.tokenA), keyOf(p.tokenB)]) {
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k)!.push(p);
    }
  }
  const dist = new Map<string, number>([[inKey, 0]]);
  let frontier = [inKey];
  for (let h = 0; h < maxHops && frontier.length; h++) {
    const next: string[] = [];
    for (const t of frontier) {
      for (const p of adj.get(t) ?? []) {
        const o = other(p, t);
        if (!dist.has(o)) {
          dist.set(o, dist.get(t)! + 1);
          next.push(o);
        }
      }
    }
    frontier = next;
  }
  if (!dist.has(outKey)) return [];

  // Sort by liquidity desc (BigInt), cap.
  const sorted = candidates.sort((a, b) => {
    const la = BigInt(a.liquidity || "0");
    const lb = BigInt(b.liquidity || "0");
    return lb > la ? 1 : lb < la ? -1 : 0;
  });
  return sorted.slice(0, cap);
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

  const tickResults = await Promise.all(
    relevant.map(async (p) => {
      try {
        return { p, ticks: await fetchPoolTicks(p.id, signal) };
      } catch (e) {
        logger.warn(`alcorTrade: tick fetch failed for pool ${p.id}`, e);
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
