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
import type { SwapToken, SwapRoute, SwapSplit, SwapRouteCandidate } from "./swapApi";
import { parseManualAllocations, splitRawByBps, type ManualAllocation } from "./manualSwap";
import { logger } from "./logger";
import {
  type AmmPoolState,
  type AmmAllocation,
  allocateAcrossAmm,
  ammMemo,
  rawToFixed,
  sameToken,
  AMM_DISPLAY_FEE,
} from "./ammQuote";

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
  /** Live Defibox / TacoSwap pools pairing tokenIn and tokenOut directly. */
  ammPools?: AmmPoolState[];
  /** Fixed user-selected route percentages. Exact-input only. */
  manualAllocations?: ManualAllocation[];
}

function alcorRouteKey(route: any): string {
  return `alcor:${route.pools.map((pool: Pool) => pool.id).join(",")}`;
}

function ammRouteKey(pool: AmmPoolState): string {
  return `${pool.venue}:${pool.id}`;
}

function routeCandidates(routes: any[], ammPools: AmmPoolState[]): SwapRouteCandidate[] {
  const alcor = routes.map((route) => ({
    key: alcorRouteKey(route),
    venue: "alcor" as const,
    route: route.pools.map((pool: Pool) => pool.id),
    contract: "swap.alcor",
    visualPath: route.tokenPath.map((token: Token) => ({
      id: tokenKey(token.contract, token.symbol),
      symbol: token.symbol,
      contract: token.contract,
      decimals: token.decimals,
    })),
    visualFees: route.pools.map((pool: Pool) => pool.fee),
    quotedInput: "",
    quotedOutput: "",
  }));
  const amm = ammPools.map((pool) => ({
    key: ammRouteKey(pool),
    venue: pool.venue,
    route: [],
    venuePoolId: pool.id,
    contract: pool.contract,
    visualPath: [pool.tokenA, pool.tokenB].map((token) => ({
      id: tokenKey(token.contract, token.symbol),
      symbol: token.symbol,
      contract: token.contract,
      decimals: token.decimals,
    })),
    visualFees: [AMM_DISPLAY_FEE],
    quotedInput: "",
    quotedOutput: "",
  }));
  return [...alcor, ...amm].filter(
    (candidate, index, all) => all.findIndex((other) => other.key === candidate.key) === index,
  );
}

// ----- Cross-venue blend (Alcor + Defibox + TacoSwap), EXACT_INPUT only -----

interface BlendResult {
  /** Alcor trade for the Alcor share, or null when 100% goes to Defibox/Taco. */
  trade: any | null;
  legs: AmmAllocation[];
  /** Percent of the input sent to Defibox/Taco. */
  share: number;
  outRaw: bigint;
}

async function blendWithAmm(args: {
  trade: any;
  ammPools: AmmPoolState[];
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  inTok: Token;
  totalRaw: bigint;
  routes: any[];
  sdkPools: Pool[];
  sdkTradeType: any;
  finePercents: number[];
}): Promise<BlendResult | null> {
  const { trade, tokenIn, tokenOut, inTok, totalRaw, sdkTradeType } = args;
  const cands = args.ammPools
    .map((pool) => {
      const inIsA = sameToken(pool.tokenA, tokenIn.ticker, tokenIn.contract);
      const outOk = inIsA
        ? sameToken(pool.tokenB, tokenOut.ticker, tokenOut.contract)
        : sameToken(pool.tokenA, tokenOut.ticker, tokenOut.contract) &&
          sameToken(pool.tokenB, tokenIn.ticker, tokenIn.contract);
      return outOk ? { pool, inIsA } : null;
    })
    .filter((c): c is { pool: AmmPoolState; inIsA: boolean } => !!c);
  if (cands.length === 0 || totalRaw <= 0n) return null;

  const outDec = tokenOut.precision;
  const toRaw = (t: any): bigint => BigInt(toRawAmount(t.outputAmount.toFixed(), outDec));
  const baseOut = toRaw(trade);

  // Alcor's side is priced by shrinking every leg of the Alcor split it already
  // found, each re-simulated on its own route. That is a real, executable trade
  // (exactly what gets sent on-chain), and costs a few milliseconds instead of a
  // whole new split search — so every 1% share can be checked.
  const legs = (trade.swaps as any[]).map((sw) => ({
    route: sw.route,
    raw: BigInt(toRawAmount(sw.inputAmount.toFixed(), tokenIn.precision)),
  }));
  const legsRawTotal = legs.reduce((acc, l) => acc + l.raw, 0n);
  if (legsRawTotal <= 0n) return null;

  const alcorScaled = (share: number): { trade: any | null; out: bigint } | null => {
    if (share >= 100) return { trade: null, out: 0n };
    const parts = legs
      .map((l) => ({ route: l.route, raw: (l.raw * BigInt(100 - share)) / 100n }))
      .filter((l) => l.raw > 0n);
    if (parts.length === 0) return { trade: null, out: 0n };
    try {
      const t = (Trade as any).fromRoutes(
        parts.map((l) => ({
          route: l.route,
          amount: CurrencyAmount.fromRawAmount(inTok, l.raw.toString()),
          percent: 0,
        })),
        sdkTradeType,
      );
      // Percent per leg, relative to Alcor's part (display only).
      const alcorTotal = parts.reduce((acc, l) => acc + l.raw, 0n);
      t.swaps.forEach((sw: any, i: number) => {
        sw.percent = Number((parts[i].raw * 10_000n) / alcorTotal) / 100;
      });
      return { trade: t, out: toRaw(t) };
    } catch {
      return null;
    }
  };

  type Eval = { total: bigint; trade: any | null; amm: ReturnType<typeof allocateAcrossAmm> };
  const cache = new Map<number, Eval | null>();
  const evalShare = (share: number): Eval | null => {
    if (cache.has(share)) return cache.get(share)!;
    const ammIn = (legsRawTotal * BigInt(share)) / 100n;
    const amm = allocateAcrossAmm(cands, ammIn);
    let res: Eval | null = null;
    if (amm.legs.length > 0) {
      const al = alcorScaled(share);
      if (al) res = { total: amm.out + al.out, trade: al.trade, amm };
    }
    cache.set(share, res);
    return res;
  };

  // Output is concave in the share: walk up from 1% while it keeps improving.
  let best = 0;
  let bestEval: Eval | null = null;
  let bestScore = baseOut;
  let worseInARow = 0;
  for (let sh = 1; sh <= 100; sh++) {
    const e = evalShare(sh);
    if (e && e.total > bestScore) {
      bestScore = e.total;
      best = sh;
      bestEval = e;
      worseInARow = 0;
    } else if (++worseInARow >= 3) {
      break;
    }
  }
  // Only use other venues when the result is strictly better than Alcor alone.
  if (!bestEval || best === 0 || bestEval.total <= baseOut) return null;
  return { trade: bestEval.trade, legs: bestEval.amm.legs, share: best, outRaw: bestEval.total };
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

  if (!trade) {
    return null;
  }

  // Slippage as SDK Percent: e.g. 1% => Percent(100, 10_000).
  const bps = Math.round(slippage * 100); // 1% -> 100bps
  const slip = new Percent(bps, 10_000);

  const exactIn = tradeType === "EXACT_INPUT";
  const opWord = exactIn ? "swapexactin" : "swapexactout";

  // Try sending part of the trade through Defibox / TacoSwap. Only kept when
  // it strictly beats Alcor alone; any failure keeps the Alcor-only quote.
  let blend: BlendResult | null = null;
  const blendStarted = performance.now();
  if (exactIn && input.ammPools && input.ammPools.length > 0) {
    try {
      blend = await blendWithAmm({
        trade,
        ammPools: input.ammPools,
        tokenIn,
        tokenOut,
        inTok,
        totalRaw: BigInt(rawAmount),
        routes,
        sdkPools,
        sdkTradeType,
        finePercents: percents,
      });
    } catch (e) {
      logger.warn("[amm-router] blend failed — Alcor only", e);
      blend = null;
    }
  }
  const alcorTrade: any | null = blend ? blend.trade : trade;
  const ammLegs = blend?.legs ?? [];
  const alcorScale = blend ? (100 - blend.share) / 100 : 1;
  const blendMs = Math.round(performance.now() - blendStarted);

  // Per-split shape mirrors Alcor's own parseTrade so the memo is byte-identical
  // to what wax.alcor.exchange sends today.
  const splitCount = (alcorTrade?.swaps.length ?? 0) + ammLegs.length;
  const perSplitBps = splitSlipBps(bps, splitCount);
  const splitSlip = new Percent(perSplitBps, 10_000);
  const alcorSplits: SwapSplit[] = (alcorTrade?.swaps ?? []).map((s: any) => {
    const poolIds: number[] = s.route.pools.map((p: Pool) => p.id);
    const visualPath = s.route.tokenPath.map((t: Token) => ({
      id: tokenKey(t.contract, t.symbol),
      symbol: t.symbol,
      contract: t.contract,
      decimals: t.decimals,
    }));
    const visualFees = s.route.pools.map((p: Pool) => p.fee);
    const maxSent = exactIn ? s.inputAmount : alcorTrade.maximumAmountIn(slip, s.inputAmount);
    const minReceived = exactIn ? alcorTrade.minimumAmountOut(splitSlip, s.outputAmount) : s.outputAmount;
    const memo = `${opWord}#${poolIds.join(",")}#${receiver}#${minReceived.toExtendedAsset()}#0`;
    return {
      percent: s.percent * alcorScale,
      route: poolIds,
      input: s.inputAmount.toFixed(),
      output: s.outputAmount.toFixed(),
      minReceived: minReceived.toFixed(),
      maxSent: maxSent.toFixed(),
      memo,
      visualPath,
      visualFees,
      venue: "alcor",
      contract: "swap.alcor",
    };
  });

  const totalRawIn = BigInt(rawAmount);
  const outTokDesc = { symbol: tokenOut.ticker, contract: tokenOut.contract, decimals: tokenOut.precision };
  const inPathTok = {
    id: tokenKey(tokenIn.contract, tokenIn.ticker),
    symbol: tokenIn.ticker,
    contract: tokenIn.contract,
    decimals: tokenIn.precision,
  };
  const outPathTok = {
    id: tokenKey(tokenOut.contract, tokenOut.ticker),
    symbol: tokenOut.ticker,
    contract: tokenOut.contract,
    decimals: tokenOut.precision,
  };
  const ammSplits: SwapSplit[] = ammLegs.map((leg) => {
    const minOut = (leg.amountOut * BigInt(10_000 - perSplitBps)) / 10_000n;
    const input = rawToFixed(leg.amountIn, tokenIn.precision);
    return {
      percent: Number((leg.amountIn * 10_000n) / totalRawIn) / 100,
      route: [],
      input,
      output: rawToFixed(leg.amountOut, tokenOut.precision),
      minReceived: rawToFixed(minOut, tokenOut.precision),
      maxSent: input,
      memo: ammMemo(leg.pool, outTokDesc, minOut),
      visualPath: [inPathTok, outPathTok],
      visualFees: [AMM_DISPLAY_FEE],
      venue: leg.pool.venue,
      contract: leg.pool.contract,
      venuePoolId: leg.pool.id,
    };
  });
  // Defibox / Taco legs go first so the last (Alcor) transfer absorbs any
  // rounding remainder when the transaction is built.
  const splits: SwapSplit[] = [...ammSplits, ...alcorSplits];

  const aggRoute: number[] = alcorTrade ? alcorTrade.swaps[0].route.pools.map((p: Pool) => p.id) : [];
  let outputNum: number;
  let minReceivedNum: number;
  let aggMemo: string;
  let priceImpact: number;
  let executionPrice: { numerator: string; denominator: string };
  if (blend) {
    const minAgg = (blend.outRaw * BigInt(10_000 - bps)) / 10_000n;
    outputNum = parseFloat(rawToFixed(blend.outRaw, tokenOut.precision));
    minReceivedNum = parseFloat(rawToFixed(minAgg, tokenOut.precision));
    aggMemo = alcorSplits[0]?.memo ?? ammSplits[0].memo!;
    // Worst leg's price impact (Alcor's from the SDK, Defibox/Taco from spot).
    const ammImpacts = ammLegs.map((leg) => {
      const rin = Number(leg.inIsA ? leg.pool.reserveA : leg.pool.reserveB);
      const rout = Number(leg.inIsA ? leg.pool.reserveB : leg.pool.reserveA);
      const ideal = (Number(leg.amountIn) * rout) / rin;
      return ideal > 0 ? Math.max(0, (1 - Number(leg.amountOut) / ideal) * 100) : 0;
    });
    const alcorImpact = alcorTrade ? parseFloat(alcorTrade.priceImpact.toFixed(4)) : 0;
    priceImpact = parseFloat(Math.max(alcorImpact, ...ammImpacts).toFixed(4));
    executionPrice = { numerator: blend.outRaw.toString(), denominator: totalRawIn.toString() };
    logger.info(
      `[amm-router] blended ${blend.share}% via ${ammLegs.map((l) => `${l.pool.venue}#${l.pool.id}`).join("+")}`,
    );
  } else {
    const aggMin = exactIn ? trade.minimumAmountOut(slip) : trade.outputAmount;
    aggMemo = `${opWord}#${aggRoute.join(",")}#${receiver}#${aggMin.toExtendedAsset()}#0`;
    outputNum = parseFloat(trade.outputAmount.toFixed());
    minReceivedNum = parseFloat(aggMin.toFixed());
    priceImpact = parseFloat(trade.priceImpact.toFixed(4));
    executionPrice = {
      numerator: trade.executionPrice.numerator.toString(),
      denominator: trade.executionPrice.denominator.toString(),
    };
  }

  const diagnostics: SwapRoute["quoteDiagnostics"] = {
    relevantPools: relevant.length,
    poolsBuilt: sdkPools.length,
    routesConsidered: routes.length,
    tickFailures,
    rateLimitedTickFailures,
    poolsDroppedNoTicks: droppedForTicks.length,
    tookMs: Math.round(performance.now() - started),
    ammPools: input.ammPools?.length ?? 0,
    blendMs,
  };

  // Defensive invariant: at positive slippage, minReceived must never exceed
  // output. Clamp + warn if a future SDK version ever violates this.
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
    priceImpact,
    memo: aggMemo,
    route: aggRoute,
    executionPrice,
    input: blend ? parseFloat(rawToFixed(totalRawIn, tokenIn.precision)) : parseFloat(trade.inputAmount.toFixed()),
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
