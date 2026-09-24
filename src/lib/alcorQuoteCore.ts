// Pure quote maths for the Alcor split router. No network access: it takes pool
// state + ticks as plain data and returns a SwapRoute. Shared by the main
// thread and the background route worker so both produce byte-identical quotes.

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

// ----- Per-split slippage widening -----
// On-chain, swap.alcor enforces `minTokenOut` per transfer. When the router
// splits a trade across multiple pools, one leg can drift more than the user's
// aggregate slippage even when the aggregate output is still inside slippage —
// aborting the whole tx. We widen only the per-split memo min; the aggregate
// `minReceived` shown to the user is unchanged.
const SPLIT_SLIPPAGE_MULTIPLIER = 3;
const SPLIT_SLIPPAGE_FLOOR_BPS = 50; // 0.5%
const SPLIT_SLIPPAGE_MAX_BPS = 1000; // 10%
export function splitSlipBps(userBps: number, splitCount: number): number {
  if (splitCount <= 1) return userBps;
  const widened = Math.max(
    userBps * SPLIT_SLIPPAGE_MULTIPLIER,
    userBps + SPLIT_SLIPPAGE_FLOOR_BPS,
  );
  return Math.min(widened, SPLIT_SLIPPAGE_MAX_BPS);
}

// ----- Raw API shapes -----

export interface RawAlcorPool {
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

export interface RawAlcorTick {
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

export function tokenKey(contract: string, symbol: string): string {
  return `${symbol.toLowerCase()}-${contract}`;
}

export function formatSdkDiagnostics(diag?: SwapRoute["quoteDiagnostics"]): string {
  if (!diag) return "";
  return ` (${diag.routesConsidered ?? "?"} routes, ${diag.poolsBuilt ?? "?"}/${diag.relevantPools ?? "?"} pools, tickFailures=${diag.tickFailures ?? 0}, rateLimited=${diag.rateLimitedTickFailures ?? 0}, ${diag.tookMs ?? "?"}ms)`;
}

// ----- Router entry: prefer WASM (matches Alcor's UI) then fall back to JS -----

export async function runBestTradeWithSplit(
  routes: any[],
  currencyAmount: any,
  percents: number[],
  sdkTradeType: any,
  sdkPools: Pool[],
  swapConfig: { minSplits: number; maxSplits: number }
): Promise<any> {
  const T = Trade as any;
  // The SDK's WASM router ships as a Node-only build (uses `require('util')`
  // and CJS `module.exports`), so it cannot load in the browser and always
  // throws "require is not defined". Skip it entirely in browser contexts to
  // avoid the noisy console error and wasted dynamic import on every quote.
  // Only Node has the WASM build. Browser main thread and the route worker
  // (which has no \`window\`) must both use the JS router.
  const isNode =
    typeof process !== "undefined" && !!(process as any).versions?.node;
  if (isNode && typeof window === "undefined" && typeof T.bestTradeWithSplitWASM === "function") {
    try {
      const wasmTrade = await T.bestTradeWithSplitWASM(
        routes,
        currencyAmount,
        percents,
        sdkTradeType,
        sdkPools,
        swapConfig
      );
      if (wasmTrade) return wasmTrade;
      logger.warn("[alcor-router] WASM router returned null — falling back to JS");
    } catch (e) {
      logger.warn("[alcor-router] WASM router threw — falling back to JS", e);
    }
  }
  return T.bestTradeWithSplit(routes, currencyAmount, percents, sdkTradeType, swapConfig);
}

export function buildPool(raw: RawAlcorPool, ticks: RawAlcorTick[]): Pool {
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

export function toRawAmount(human: string, decimals: number): string {
  // Convert "1.23" @ decimals=8 → "123000000". Avoids float precision.
  const [whole, frac = ""] = human.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const raw = (whole || "0") + fracPadded;
  const trimmed = raw.replace(/^0+(?=\d)/, "");
  return trimmed || "0";
}

export interface QuoteInput {
  pools: Array<{ p: RawAlcorPool; ticks: RawAlcorTick[] }>;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  amount: string;
  slippage: number;
  receiver: string;
  tradeType: "EXACT_INPUT" | "EXACT_OUTPUT";
  maxHops: number;
  distributionPercent: number;
  relevantCount: number;
  tickFailures: number;
  rateLimitedTickFailures: number;
  /** performance.now() when the quote started, for diagnostics. */
  started: number;
}

/** Everything after the network: build pools, search splits, emit memos. */
export async function quoteFromData(input: QuoteInput): Promise<SwapRoute | null> {
  const {
    tokenIn, tokenOut, amount, slippage, receiver, tradeType, maxHops,
    distributionPercent, tickFailures, rateLimitedTickFailures, started,
  } = input;
  const tickResults = input.pools;
  const relevant = { length: input.relevantCount };
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

  // Diagnostic: log which pools were excluded from the SDK graph because they
  // returned no ticks after retry. This is the mechanism that historically
  // caused the WAX→WAXWBTC split to collapse to a single route when a WAXBTC
  // endpoint pool was silently dropped.
  const droppedForTicks = tickResults
    .filter((r) => r.ticks.length === 0)
    .map((r) => r.p.id);
  if (droppedForTicks.length > 0) {
    logger.warn(
      `[alcor-router] Dropped ${droppedForTicks.length} pool(s) with 0 ticks after retry`,
      droppedForTicks,
    );
  }

  if (sdkPools.length === 0) {
    return null;
  }

  const inTok = new Token(tokenIn.contract, tokenIn.precision, tokenIn.ticker);
  const outTok = new Token(tokenOut.contract, tokenOut.precision, tokenOut.ticker);

  const routes = computeAllRoutes(inTok, outTok, sdkPools, maxHops);
  if (routes.length === 0) {
    return null;
  }

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
  const trade = await runBestTradeWithSplit(
    routes,
    currencyAmount,
    percents,
    sdkTradeType,
    sdkPools,
    { minSplits: 1, maxSplits: 6 }
  );

  const diagnostics: SwapRoute["quoteDiagnostics"] = {
    relevantPools: relevant.length,
    poolsBuilt: sdkPools.length,
    routesConsidered: routes.length,
    tickFailures,
    rateLimitedTickFailures,
    poolsDroppedNoTicks: droppedForTicks.length,
    tookMs: Math.round(performance.now() - started),
  };

  if (!trade) {
    return null;
  }

  // Slippage as SDK Percent: e.g. 1% => Percent(100, 10_000).
  const bps = Math.round(slippage * 100); // 1% -> 100bps
  const slip = new Percent(bps, 10_000);

  const exactIn = tradeType === "EXACT_INPUT";
  const opWord = exactIn ? "swapexactin" : "swapexactout";

  // Per-split shape mirrors Alcor's own parseTrade so the memo is byte-identical
  // to what wax.alcor.exchange sends today.
  const splitCount = trade.swaps.length;
  const perSplitBps = splitSlipBps(bps, splitCount);
  const splitSlip = new Percent(perSplitBps, 10_000);
  const splits: SwapSplit[] = trade.swaps.map((s: any) => {
    const poolIds: number[] = s.route.pools.map((p: Pool) => p.id);
    const visualPath = s.route.tokenPath.map((t: Token) => ({
      id: tokenKey(t.contract, t.symbol),
      symbol: t.symbol,
      contract: t.contract,
      decimals: t.decimals,
    }));
    const visualFees = s.route.pools.map((p: Pool) => p.fee);
    const maxSent = exactIn ? s.inputAmount : trade.maximumAmountIn(slip, s.inputAmount);
    const minReceived = exactIn ? trade.minimumAmountOut(splitSlip, s.outputAmount) : s.outputAmount;
    const memo = `${opWord}#${poolIds.join(",")}#${receiver}#${minReceived.toExtendedAsset()}#0`;
    return {
      percent: s.percent,
      route: poolIds,
      input: s.inputAmount.toFixed(),
      output: s.outputAmount.toFixed(),
      minReceived: minReceived.toFixed(),
      maxSent: maxSent.toFixed(),
      memo,
      visualPath,
      visualFees,
    };
  });

  const aggMin = exactIn ? trade.minimumAmountOut(slip) : trade.outputAmount;
  const aggRoute: number[] = trade.swaps[0].route.pools.map((p: Pool) => p.id);
  const aggMemo = `${opWord}#${aggRoute.join(",")}#${receiver}#${aggMin.toExtendedAsset()}#0`;

  // Defensive invariant: at positive slippage, minReceived must never exceed
  // output. Clamp + warn if a future SDK version ever violates this.
  const outputNum = parseFloat(trade.outputAmount.toFixed());
  let minReceivedNum = parseFloat(aggMin.toFixed());
  if (exactIn && minReceivedNum > outputNum) {
    logger.warn("[alcor-router] minReceived > output; clamping", {
      output: outputNum,
      minReceived: minReceivedNum,
    });
    minReceivedNum = outputNum;
  }

  const result = {
    output: outputNum,
    minReceived: minReceivedNum,
    priceImpact: parseFloat(trade.priceImpact.toFixed(4)),
    memo: aggMemo,
    route: aggRoute,
    executionPrice: {
      numerator: trade.executionPrice.numerator.toString(),
      denominator: trade.executionPrice.denominator.toString(),
    },
    input: parseFloat(trade.inputAmount.toFixed()),
    swaps: splits,
    quoteSource: "sdk",
    quoteComplete: tickFailures === 0,
    quoteDiagnostics: diagnostics,
  } as SwapRoute;

  logger.info(
    `[alcor-router] SDK quote produced ${splits.length} split(s) [grid=${distributionPercent}%, maxHops=${maxHops}, per-split slip=${perSplitBps / 100}%]${formatSdkDiagnostics(diagnostics)}`,
  );

  return result;
}
