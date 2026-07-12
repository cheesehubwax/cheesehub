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

// ----- Global Alcor cooldown -----
// After any 429 anywhere in the app, back off all NON-essential Alcor fanout
// (SDK tick fetches, per-pool detail fetches) for a while. The single HTTP
// router call is still allowed since it's one request and it's what the
// widget actually needs to quote.
let alcorCooldownUntil = 0;
const ALCOR_COOLDOWN_MS = 30_000;
export function markAlcorRateLimited() {
  alcorCooldownUntil = Date.now() + ALCOR_COOLDOWN_MS;
}
export function isAlcorCoolingDown(): boolean {
  return Date.now() < alcorCooldownUntil;
}

// ----- Per-split slippage widening -----
// On-chain, swap.alcor enforces `minTokenOut` per transfer. When the router
// splits a trade across multiple pools, one leg can drift more than the user's
// aggregate slippage even when the aggregate output is still inside slippage —
// aborting the whole tx. We widen only the per-split memo min; the aggregate
// `minReceived` shown to the user is unchanged.
const SPLIT_SLIPPAGE_MULTIPLIER = 3;
const SPLIT_SLIPPAGE_FLOOR_BPS = 50; // 0.5%
const SPLIT_SLIPPAGE_MAX_BPS = 1000; // 10%
function splitSlipBps(userBps: number, splitCount: number): number {
  if (splitCount <= 1) return userBps;
  const widened = Math.max(
    userBps * SPLIT_SLIPPAGE_MULTIPLIER,
    userBps + SPLIT_SLIPPAGE_FLOOR_BPS,
  );
  return Math.min(widened, SPLIT_SLIPPAGE_MAX_BPS);
}

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
const POOLS_TTL_MS = 20_000;

export async function fetchAllAlcorPools(signal?: AbortSignal): Promise<RawAlcorPool[]> {
  if (poolsCache && Date.now() - poolsCache.at < POOLS_TTL_MS) return poolsCache.data;
  if (poolsInflight) return poolsInflight;
  poolsInflight = (async () => {
    const res = await fetch(`${ALCOR_API}/swap/pools`, { signal });
    if (!res.ok) {
      if (res.status === 429) {
        markAlcorRateLimited();
        throw new Error("Rate limited — please wait a moment and try again");
      }
      throw new Error(`Failed to fetch Alcor pools (${res.status})`);
    }
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
const TICKS_TTL_MS = 5 * 60_000;
// Negative cache for failed tick fetches so we don't hammer the same pool.
const ticksFailCache = new Map<number, number>();
const TICKS_FAIL_TTL_MS = 8_000;
const TICK_CONCURRENCY = 10;

export async function fetchPoolTicks(poolId: number, signal?: AbortSignal): Promise<RawAlcorTick[]> {
  const cached = ticksCache.get(poolId);
  if (cached && Date.now() - cached.at < TICKS_TTL_MS) return cached.data;
  const failedAt = ticksFailCache.get(poolId);
  if (failedAt && Date.now() - failedAt < TICKS_FAIL_TTL_MS) {
    throw new Error(`ticks recently failed for pool ${poolId}`);
  }
  const inflight = ticksInflight.get(poolId);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const res = await fetch(`${ALCOR_API}/swap/pools/${poolId}/ticks`, { signal });
      if (!res.ok) {
        if (res.status === 429) markAlcorRateLimited();
        ticksFailCache.set(poolId, Date.now());
        throw new Error(
          res.status === 429
            ? "Rate limited — please wait a moment and try again"
            : `Failed to fetch ticks for pool ${poolId} (${res.status})`,
        );
      }
      const data = (await res.json()) as RawAlcorTick[];
      ticksCache.set(poolId, { at: Date.now(), data });
      return data;
    } catch (e) {
      if ((e as any)?.name !== "AbortError") ticksFailCache.set(poolId, Date.now());
      throw e;
    }
  })();
  ticksInflight.set(poolId, p);
  try {
    return await p;
  } finally {
    ticksInflight.delete(poolId);
  }
}

/**
 * Fetch pool ticks with a single bounded retry. Endpoint pools for
 * low-liquidity tokens (e.g. WAXBTC) are the most likely victims of a
 * transient 429 or network blip during the concurrent fan-out. If the first
 * attempt lands in the negative cache or throws, we clear the negative-cache
 * entry and try once more after a jittered delay. Abort errors are propagated
 * immediately.
 */
export async function fetchPoolTicksWithRetry(
  poolId: number,
  signal?: AbortSignal,
): Promise<RawAlcorTick[]> {
  try {
    return await fetchPoolTicks(poolId, signal);
  } catch (e) {
    if ((e as any)?.name === "AbortError") throw e;
    // Bust the 8s negative cache so the retry actually hits the network.
    ticksFailCache.delete(poolId);
    // Jittered backoff to avoid re-entering the same 429 window.
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
    if (signal?.aborted) {
      const err = new Error("aborted");
      (err as any).name = "AbortError";
      throw err;
    }
    return await fetchPoolTicks(poolId, signal);
  }
}

function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("Rate limited");
}

// Run promises with a fixed concurrency limit.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
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
  "lsw-lsw.alcor",
  "lswax-token.lswax",
  "lswax-token.fusion",
  "cheese-cheeseburger",
]);

// Narrower intermediary set for deterministic route coverage. These are the
// base assets Alcor commonly uses for cross-token routes; excluding app/social
// tokens here prevents the split seeding from manufacturing odd detours while
// still keeping WAXUSDC→WAXWBTC reachable.
const ROUTE_COVERAGE_HUB_KEYS = new Set([
  "wax-eosio.token",
  "usdt-usdt.alcor",
  "usdc-usdc.alcor",
  "waxusdc-eth.token",
  "waxusdt-eth.token",
  "usdc-tethertether",
  "waxwbtc-eth.token",
  "lsw-lsw.alcor",
  "lswax-token.lswax",
  "lswax-token.fusion",
]);

/** Select pools that could participate in a tokenIn→tokenOut route of length
 *  ≤ maxHops. Considers every active pool (matching Alcor's own router), uses
 *  forward+reverse BFS over the full graph to keep only pools that plausibly
 *  lie on some ≤maxHops path, and caps the result to protect the ticks fan-out. */
function selectRelevantPools(
  pools: RawAlcorPool[],
  inKey: string,
  outKey: string,
  maxHops: number,
  cap = 56
): RawAlcorPool[] {
  const keyOf = (t: RawAlcorPool["tokenA"]) => tokenKey(t.contract, t.symbol);
  const active = pools.filter((p) => p.active);
  const liquidityOf = (p: RawAlcorPool): bigint => {
    try {
      return BigInt(p.liquidity || "0");
    } catch {
      return 0n;
    }
  };
  const isDirectPair = (p: RawAlcorPool, aKey: string, bKey: string) => {
    const a = keyOf(p.tokenA);
    const b = keyOf(p.tokenB);
    return (a === aKey && b === bKey) || (a === bKey && b === aKey);
  };

  const other = (p: RawAlcorPool, k: string) =>
    keyOf(p.tokenA) === k ? keyOf(p.tokenB) : keyOf(p.tokenA);

  // Full-graph adjacency (no hub whitelist).
  const adj = new Map<string, RawAlcorPool[]>();
  for (const p of active) {
    for (const k of [keyOf(p.tokenA), keyOf(p.tokenB)]) {
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k)!.push(p);
    }
  }

  // BFS from a source, bounded by maxHops.
  const bfs = (src: string): Map<string, number> => {
    const dist = new Map<string, number>([[src, 0]]);
    let frontier = [src];
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
    return dist;
  };

  const distIn = bfs(inKey);
  const distOut = bfs(outKey);
  if (!distIn.has(outKey)) return [];

  // Keep pools whose both endpoints are reachable such that dist_in(a) + 1 +
  // dist_out(b) ≤ maxHops (or the mirrored orientation), i.e. the pool can lie
  // on some ≤maxHops path from tokenIn to tokenOut.
  const candidates = active.filter((p) => {
    const a = keyOf(p.tokenA);
    const b = keyOf(p.tokenB);
    const da = distIn.get(a);
    const db = distIn.get(b);
    const ea = distOut.get(a);
    const eb = distOut.get(b);
    const forward = da !== undefined && eb !== undefined && da + 1 + eb <= maxHops;
    const reverse = db !== undefined && ea !== undefined && db + 1 + ea <= maxHops;
    return forward || reverse;
  });

  // Ranking matters because every selected pool needs a tick request. Keep the
  // shortest plausible routes first, then liquid endpoint/hub pools. This avoids
  // burning the first quote on dozens of obscure endpoint pools and hitting 429s
  // before the split router has the pools Alcor's UI actually uses.
  const poolRank = (p: RawAlcorPool) => {
    const a = keyOf(p.tokenA);
    const b = keyOf(p.tokenB);
    const da = distIn.get(a);
    const db = distIn.get(b);
    const ea = distOut.get(a);
    const eb = distOut.get(b);
    const pathLen = Math.min(
      da !== undefined && eb !== undefined ? da + 1 + eb : Number.POSITIVE_INFINITY,
      db !== undefined && ea !== undefined ? db + 1 + ea : Number.POSITIVE_INFINITY,
    );
    const direct = (a === inKey && b === outKey) || (a === outKey && b === inKey);
    const touchesIn = a === inKey || b === inKey;
    const touchesOut = a === outKey || b === outKey;
    const touchesEndpoint = touchesIn || touchesOut;
    const touchesHub = HUB_KEYS.has(a) || HUB_KEYS.has(b);
    const hubHub = HUB_KEYS.has(a) && HUB_KEYS.has(b);
    const endpointHub = touchesEndpoint && touchesHub;
    const classRank = direct ? 0 : endpointHub ? 1 : hubHub ? 2 : touchesEndpoint ? 3 : touchesHub ? 4 : 5;
    return { pathLen, classRank };
  };

  const ranked = candidates.slice().sort((a, b) => {
    const ra = poolRank(a);
    const rb = poolRank(b);
    if (ra.pathLen !== rb.pathLen) return ra.pathLen - rb.pathLen;
    if (ra.classRank !== rb.classRank) return ra.classRank - rb.classRank;
    const la = liquidityOf(a);
    const lb = liquidityOf(b);
    return lb > la ? 1 : lb < la ? -1 : 0;
  });

  // Deterministic two-hop coverage: the broad graph can contain thousands of
  // plausible pools, so a simple ranked cap can drop the endpoint leg of a real
  // Alcor split (notably WAXUSDC→WAXWBTC). Seed the selected set with liquid
  // endpoint pools plus their best direct connector before filling by rank.
  const selected: RawAlcorPool[] = [];
  const selectedIds = new Set<number>();
  const addPool = (p: RawAlcorPool | undefined) => {
    if (!p || selectedIds.has(p.id) || selected.length >= cap) return;
    selectedIds.add(p.id);
    selected.push(p);
  };
  const pairKey = (aKey: string, bKey: string) =>
    aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
  const pairIndex = new Map<string, RawAlcorPool[]>();
  for (const p of active) {
    if (liquidityOf(p) <= 0n) continue;
    const a = keyOf(p.tokenA);
    const b = keyOf(p.tokenB);
    const k = pairKey(a, b);
    if (!pairIndex.has(k)) pairIndex.set(k, []);
    pairIndex.get(k)!.push(p);
  }
  for (const list of pairIndex.values()) {
    list.sort((a, b) => {
      // Keep more than one fee tier available, but prefer the most liquid
      // connector first. The router will decide the final allocation.
      const la = liquidityOf(a);
      const lb = liquidityOf(b);
      if (la !== lb) return lb > la ? 1 : -1;
      return a.fee - b.fee;
    });
  }
  const pairPools = (aKey: string, bKey: string) =>
    pairIndex.get(pairKey(aKey, bKey)) ?? [];

  // Direct pools remain first so the cheapest/simplest route is never delayed
  // behind wider split-route coverage.
  for (const p of ranked) {
    if (isDirectPair(p, inKey, outKey)) addPool(p);
  }

  const endpointCandidates = maxHops >= 2 ? ranked
    .filter((p) => {
      const a = keyOf(p.tokenA);
      const b = keyOf(p.tokenB);
      if (liquidityOf(p) <= 0n) return false;
      const touchesIn = a === inKey || b === inKey;
      const touchesOut = a === outKey || b === outKey;
      const intermediate = touchesIn ? other(p, inKey) : other(p, outKey);
      if (!ROUTE_COVERAGE_HUB_KEYS.has(intermediate)) return false;
      if (touchesIn && !touchesOut) return pairPools(intermediate, outKey).length > 0;
      if (touchesOut && !touchesIn) return pairPools(inKey, intermediate).length > 0;
      return false;
    })
    .sort((a, b) => {
      const aKey = keyOf(a.tokenA) === inKey || keyOf(a.tokenB) === inKey ? other(a, inKey) : other(a, outKey);
      const bKey = keyOf(b.tokenA) === inKey || keyOf(b.tokenB) === inKey ? other(b, inKey) : other(b, outKey);
      const aHub = ROUTE_COVERAGE_HUB_KEYS.has(aKey) ? 0 : 1;
      const bHub = ROUTE_COVERAGE_HUB_KEYS.has(bKey) ? 0 : 1;
      if (aHub !== bHub) return aHub - bHub;
      if (a.fee !== b.fee) return a.fee - b.fee;
      const la = liquidityOf(a);
      const lb = liquidityOf(b);
      return lb > la ? 1 : lb < la ? -1 : 0;
    }) : [];

  let endpointRoutesSeeded = 0;
  const endpointCoverageLimit = Math.min(cap, Math.max(12, Math.floor(cap * 0.6)));
  for (const endpointPool of endpointCandidates) {
    if (selected.length >= endpointCoverageLimit) break;
    const a = keyOf(endpointPool.tokenA);
    const b = keyOf(endpointPool.tokenB);
    const touchesIn = a === inKey || b === inKey;
    const intermediate = touchesIn ? other(endpointPool, inKey) : other(endpointPool, outKey);
    const connectors = touchesIn ? pairPools(intermediate, outKey) : pairPools(inKey, intermediate);
    const before = selected.length;
    addPool(endpointPool);
    // Include the top two direct connector fee/liquidity choices. This keeps
    // WAX→WAXUSDC plus WAXUSDC→WAXWBTC available without unbounded fan-out.
    addPool(connectors[0]);
    addPool(connectors[1]);
    if (selected.length > before) endpointRoutesSeeded += 1;
  }

  for (const p of ranked) {
    if (selected.length >= cap) break;
    addPool(p);
  }

  if (endpointRoutesSeeded > 0) {
    logger.info(
      `[alcor-router] endpoint route coverage seeded ${endpointRoutesSeeded} route(s), selected ${selected.length}/${ranked.length} pools`,
    );
  }

  return selected;
}

function formatSdkDiagnostics(diag?: SwapRoute["quoteDiagnostics"]): string {
  if (!diag) return "";
  return ` (${diag.routesConsidered ?? "?"} routes, ${diag.poolsBuilt ?? "?"}/${diag.relevantPools ?? "?"} pools, tickFailures=${diag.tickFailures ?? 0}, rateLimited=${diag.rateLimitedTickFailures ?? 0}, ${diag.tookMs ?? "?"}ms)`;
}

// ----- Pool construction -----

// ----- Router entry: prefer WASM (matches Alcor's UI) then fall back to JS -----

async function runBestTradeWithSplit(
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
  const isBrowser = typeof window !== "undefined";
  if (!isBrowser && typeof T.bestTradeWithSplitWASM === "function") {
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
    distributionPercent = 1,
    signal,
  } = args;

  const started = performance.now();
  const inKey = tokenKey(tokenIn.contract, tokenIn.ticker);
  const outKey = tokenKey(tokenOut.contract, tokenOut.ticker);

  const allPools = await fetchAllAlcorPools(signal);
  const relevant = selectRelevantPools(allPools, inKey, outKey, maxHops);
  if (relevant.length === 0) return null;

  // Fetch ticks for every relevant pool in parallel.
  // Fetch ticks with bounded concurrency so we don't hammer Alcor into 429s.
  const tickResults = await mapWithConcurrency(relevant, TICK_CONCURRENCY, async (p) => {
    try {
      return { p, ticks: await fetchPoolTicksWithRetry(p.id, signal) };
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

  const trade = await runBestTradeWithSplit(
    routes,
    currencyAmount,
    percents,
    tradeType === "EXACT_INPUT" ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT,
    sdkPools,
    { minSplits: 1, maxSplits: 6 }
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
    distributionPercent = 1,
    signal,
  } = args;

  const started = performance.now();

  const inKey = tokenKey(tokenIn.contract, tokenIn.ticker);
  const outKey = tokenKey(tokenOut.contract, tokenOut.ticker);

  const allPools = await fetchAllAlcorPools(signal);
  const relevant = selectRelevantPools(allPools, inKey, outKey, maxHops);
  if (relevant.length === 0) return null;

  let tickFailures = 0;
  let rateLimitedTickFailures = 0;
  const tickResults = await mapWithConcurrency(relevant, TICK_CONCURRENCY, async (p) => {
    try {
      return { p, ticks: await fetchPoolTicksWithRetry(p.id, signal) };
    } catch (e) {
      if ((e as any)?.name === "AbortError") throw e;
      tickFailures += 1;
      if (isRateLimitError(e)) rateLimitedTickFailures += 1;
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

// Warm the pool-list cache on module import so the first quote (or route
// detail lookup) doesn't pay for the /swap/pools round-trip. Respects the
// global cooldown and swallows errors — this is best-effort.
if (typeof window !== "undefined") {
  setTimeout(() => {
    if (isAlcorCoolingDown()) return;
    fetchAllAlcorPools().catch(() => {});
  }, 0);
}

