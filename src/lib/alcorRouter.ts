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
const TICKS_FAIL_TTL_MS = 12_000;
const TICKS_RATE_LIMIT_FAIL_TTL_MS = 60_000;

// Alcor's tick endpoint rate-limits hard when the browser fans out dozens of
// /ticks requests. Keep one global queue so overlapping quote attempts share a
// slow lane instead of stampeding the API.
const TICK_QUEUE_CONCURRENCY = 2;
const TICK_QUEUE_SPACING_MS = 180;
const TICK_RETRY_DELAYS_MS = [900, 2_200];
type TickQueueJob = {
  run: () => Promise<void>;
  signal?: AbortSignal;
};
const tickQueue: TickQueueJob[] = [];
let tickQueueActive = 0;
let tickQueueTimer: ReturnType<typeof setTimeout> | null = null;
let tickQueueLastStart = 0;

function makeAbortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(makeAbortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(makeAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function pumpTickQueue() {
  if (tickQueueTimer) {
    clearTimeout(tickQueueTimer);
    tickQueueTimer = null;
  }
  while (tickQueueActive < TICK_QUEUE_CONCURRENCY && tickQueue.length > 0) {
    const wait = Math.max(0, TICK_QUEUE_SPACING_MS - (Date.now() - tickQueueLastStart));
    if (wait > 0) {
      tickQueueTimer = setTimeout(pumpTickQueue, wait);
      return;
    }
    const job = tickQueue.shift()!;
    if (job.signal?.aborted) continue;
    tickQueueActive += 1;
    tickQueueLastStart = Date.now();
    job.run().finally(() => {
      tickQueueActive -= 1;
      pumpTickQueue();
    });
  }
}

function enqueueTickFetch<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(makeAbortError());
  return new Promise((resolve, reject) => {
    let settled = false;
    const job: TickQueueJob = {
      signal,
      run: async () => {
        if (settled) return;
        signal?.removeEventListener("abort", onAbort);
        if (signal?.aborted) {
          settled = true;
          reject(makeAbortError());
          return;
        }
        try {
          const result = await task();
          settled = true;
          resolve(result);
        } catch (e) {
          settled = true;
          reject(e);
        }
      },
    };
    const onAbort = () => {
      if (settled) return;
      const idx = tickQueue.indexOf(job);
      if (idx >= 0) tickQueue.splice(idx, 1);
      settled = true;
      reject(makeAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    tickQueue.push(job);
    pumpTickQueue();
  });
}

export async function fetchPoolTicks(poolId: number, signal?: AbortSignal): Promise<RawAlcorTick[]> {
  const cached = ticksCache.get(poolId);
  if (cached && Date.now() - cached.at < TICKS_TTL_MS) return cached.data;
  const failedAt = ticksFailCache.get(poolId);
  if (failedAt && Date.now() - failedAt < TICKS_RATE_LIMIT_FAIL_TTL_MS) {
    throw new Error(`ticks recently failed for pool ${poolId}`);
  }
  const inflight = ticksInflight.get(poolId);
  if (inflight) return inflight;
  const p = (async () => {
    for (let attempt = 0; attempt <= TICK_RETRY_DELAYS_MS.length; attempt++) {
      const res = await enqueueTickFetch(
        () => fetch(`${ALCOR_API}/swap/pools/${poolId}/ticks`, { signal }),
        signal,
      );
      if (res.ok) {
        const data = (await res.json()) as RawAlcorTick[];
        ticksCache.set(poolId, { at: Date.now(), data });
        ticksFailCache.delete(poolId);
        return data;
      }
      if (res.status === 429) {
        markAlcorRateLimited();
        if (attempt < TICK_RETRY_DELAYS_MS.length) {
          await delay(TICK_RETRY_DELAYS_MS[attempt], signal);
          continue;
        }
        ticksFailCache.set(poolId, Date.now());
        throw new Error("Rate limited — please wait a moment and try again");
      }
      ticksFailCache.set(poolId, Date.now() - (TICKS_RATE_LIMIT_FAIL_TTL_MS - TICKS_FAIL_TTL_MS));
      throw new Error(`Failed to fetch ticks for pool ${poolId} (${res.status})`);
    }
    throw new Error(`Failed to fetch ticks for pool ${poolId}`);
  })();
  ticksInflight.set(poolId, p);
  try {
    return await p;
  } finally {
    ticksInflight.delete(poolId);
  }
}

function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("Rate limited");
}

function incompleteSdkRouteError(diagnostics: SwapRoute["quoteDiagnostics"]): Error {
  return new Error(
    `Failed to fetch complete split route — retrying${formatSdkDiagnostics(diagnostics)}`,
  );
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

/** Select pools that could participate in a tokenIn→tokenOut route of length
 *  ≤ maxHops. Considers every active pool (matching Alcor's own router), uses
 *  forward+reverse BFS over the full graph to keep only pools that plausibly
 *  lie on some ≤maxHops path, and caps the result to protect the ticks fan-out. */
function selectRelevantPools(
  pools: RawAlcorPool[],
  inKey: string,
  outKey: string,
  maxHops: number,
  cap = 96
): RawAlcorPool[] {
  const keyOf = (t: RawAlcorPool["tokenA"]) => tokenKey(t.contract, t.symbol);
  const active = pools.filter((p) => p.active);

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
    const la = BigInt(a.liquidity || "0");
    const lb = BigInt(b.liquidity || "0");
    return lb > la ? 1 : lb < la ? -1 : 0;
  });

  // Endpoint-touching pools (any active pool with tokenIn or tokenOut on
  // either side) must never be dropped: every final leg of any split routes
  // through one of them, so trimming them here directly costs output. Include
  // them unconditionally, then fill the remaining slots from the ranked list
  // up to `cap`.
  const touchesEndpoint = (p: RawAlcorPool) => {
    const a = keyOf(p.tokenA);
    const b = keyOf(p.tokenB);
    return a === inKey || b === inKey || a === outKey || b === outKey;
  };
  const endpointPools = active.filter(touchesEndpoint);
  const endpointIds = new Set(endpointPools.map((p) => p.id));
  const filler = ranked.filter((p) => !endpointIds.has(p.id));
  const remaining = Math.max(0, cap - endpointPools.length);
  return [...endpointPools, ...filler.slice(0, remaining)];
}

function poolStage(p: RawAlcorPool, inKey: string, outKey: string): number {
  const a = tokenKey(p.tokenA.contract, p.tokenA.symbol);
  const b = tokenKey(p.tokenB.contract, p.tokenB.symbol);
  const direct = (a === inKey && b === outKey) || (a === outKey && b === inKey);
  if (direct) return 0;
  const touchesEndpoint = a === inKey || b === inKey || a === outKey || b === outKey;
  const touchesHub = HUB_KEYS.has(a) || HUB_KEYS.has(b);
  if (touchesEndpoint && touchesHub) return 1;
  if (touchesEndpoint) return 2;
  if (touchesHub) return 3;
  return 4;
}

function orderPoolsForTickFetch(pools: RawAlcorPool[], inKey: string, outKey: string): RawAlcorPool[] {
  return pools.slice().sort((a, b) => {
    const stageA = poolStage(a, inKey, outKey);
    const stageB = poolStage(b, inKey, outKey);
    if (stageA !== stageB) return stageA - stageB;
    const la = BigInt(a.liquidity || "0");
    const lb = BigInt(b.liquidity || "0");
    return lb > la ? 1 : lb < la ? -1 : 0;
  });
}

function getTickQueueStats() {
  return {
    active: tickQueueActive,
    queued: tickQueue.length,
    cooldownMs: Math.max(0, alcorCooldownUntil - Date.now()),
  };
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
  if (typeof T.bestTradeWithSplitWASM === "function") {
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
  const tickResults = await mapWithConcurrency(relevant, 10, async (p) => {
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

  const trade = await runBestTradeWithSplit(
    routes,
    currencyAmount,
    percents,
    tradeType === "EXACT_INPUT" ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT,
    sdkPools,
    { minSplits: 1, maxSplits: 10 }
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
  const relevant = orderPoolsForTickFetch(selectRelevantPools(allPools, inKey, outKey, maxHops), inKey, outKey);
  if (relevant.length === 0) return null;

  const inTok = new Token(tokenIn.contract, tokenIn.precision, tokenIn.ticker);
  const outTok = new Token(tokenOut.contract, tokenOut.precision, tokenOut.ticker);

  const rawAmount = toRawAmount(
    amount,
    tradeType === "EXACT_INPUT" ? tokenIn.precision : tokenOut.precision
  );
  const currencyAmount = CurrencyAmount.fromRawAmount(
    tradeType === "EXACT_INPUT" ? inTok : outTok,
    rawAmount
  );

  const sdkTradeType = tradeType === "EXACT_INPUT" ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT;
  const exactInEval = tradeType === "EXACT_INPUT";

  // Run the split optimizer at both a fine (1%) and coarse (5%) grid and keep
  // whichever trade is objectively better. `bestTradeWithSplit` is a greedy
  // heuristic; finer granularity is usually better but can occasionally land
  // in a worse local optimum, so we defend against it cheaply here.
  const buildPercents = (step: number) => {
    const out: number[] = [];
    for (let p = step; p <= 100; p += step) out.push(p);
    return out;
  };
  const fineStep = distributionPercent;
  const coarseStep = 5;
  const gridConfigs: { step: number; maxSplits: number }[] = [
    { step: fineStep, maxSplits: 10 },
  ];
  if (coarseStep !== fineStep) gridConfigs.push({ step: coarseStep, maxSplits: 6 });

  const isBetterTrade = (candidate: any, current: any | null) => {
    if (!current) return true;
    const cur = exactInEval
      ? parseFloat(current.outputAmount.toFixed())
      : parseFloat(current.inputAmount.toFixed());
    const cand = exactInEval
      ? parseFloat(candidate.outputAmount.toFixed())
      : parseFloat(candidate.inputAmount.toFixed());
    return exactInEval ? cand > cur : cand < cur;
  };

  const evaluatePools = async (sdkPools: Pool[]) => {
    if (sdkPools.length === 0) return null;
    const routes = computeAllRoutes(inTok, outTok, sdkPools, maxHops);
    if (routes.length === 0) return null;

    const gridTrades = await Promise.all(
      gridConfigs.map((cfg) =>
        runBestTradeWithSplit(
          routes,
          currencyAmount,
          buildPercents(cfg.step),
          sdkTradeType,
          sdkPools,
          { minSplits: 1, maxSplits: cfg.maxSplits }
        ).catch((e) => {
          logger.warn(`[alcor-router] split search failed at step=${cfg.step}`, e);
          return null;
        })
      )
    );

    let trade: any = null;
    let bestGrid: { step: number; maxSplits: number } | null = null;
    gridTrades.forEach((t, i) => {
      if (!t) return;
      if (isBetterTrade(t, trade)) {
        trade = t;
        bestGrid = gridConfigs[i];
      }
    });

    return {
      trade,
      bestGrid,
      routesConsidered: routes.length,
      gridOutputs: gridTrades.map((t, i) => ({
        step: gridConfigs[i].step,
        output: t ? parseFloat(t.outputAmount.toFixed()) : null,
        input: t ? parseFloat(t.inputAmount.toFixed()) : null,
        splits: t ? t.swaps.length : 0,
      })),
    };
  };

  let tickFailures = 0;
  let rateLimitedTickFailures = 0;
  let tickRequests = 0;
  let ticksSucceeded = 0;
  let completedAllTicks = true;
  const sdkPools: Pool[] = [];
  let bestEval: Awaited<ReturnType<typeof evaluatePools>> | null = null;

  const TICK_BATCH_SIZE = 12;
  for (let start = 0; start < relevant.length; start += TICK_BATCH_SIZE) {
    const batch = relevant.slice(start, start + TICK_BATCH_SIZE);
    const rateLimitsBeforeBatch = rateLimitedTickFailures;
    const batchResults = await mapWithConcurrency(batch, 4, async (p) => {
      try {
        tickRequests += 1;
        return { p, ticks: await fetchPoolTicks(p.id, signal) };
      } catch (e) {
        if ((e as any)?.name === "AbortError") throw e;
        tickFailures += 1;
        if (isRateLimitError(e)) rateLimitedTickFailures += 1;
        logger.warn(`alcorTrade: tick fetch failed for pool ${p.id}`, e);
        return { p, ticks: [] as RawAlcorTick[] };
      }
    });

    for (const r of batchResults) {
      if (r.ticks.length === 0) continue;
      ticksSucceeded += 1;
      try {
        sdkPools.push(buildPool(r.p, r.ticks));
      } catch (e) {
        tickFailures += 1;
        logger.warn(`alcorTrade: pool build failed for pool ${r.p.id}`, e);
      }
    }

    const candidate = await evaluatePools(sdkPools);
    if (candidate?.trade && isBetterTrade(candidate.trade, bestEval?.trade ?? null)) {
      bestEval = candidate;
    }

    if (rateLimitedTickFailures > rateLimitsBeforeBatch && bestEval?.trade) {
      completedAllTicks = false;
      logger.warn(
        `[alcor-router] stopping tick fetch early after rate limit; using best partial quote (${sdkPools.length}/${relevant.length} pools built)`,
        getTickQueueStats(),
      );
      break;
    }
  }

  const diagnostics: SwapRoute["quoteDiagnostics"] = {
    relevantPools: relevant.length,
    poolsBuilt: sdkPools.length,
    routesConsidered: bestEval?.routesConsidered ?? 0,
    tickFailures,
    rateLimitedTickFailures,
    tickRequests,
    ticksSucceeded,
    queueDepth: getTickQueueStats().active + getTickQueueStats().queued,
    quotePartial: !completedAllTicks || tickFailures > 0,
    tookMs: Math.round(performance.now() - started),
  };

  if (!bestEval?.trade) {
    if (tickFailures > 0) throw incompleteSdkRouteError(diagnostics);
    return null;
  }

  const trade = bestEval.trade;
  const bestGrid = bestEval.bestGrid;
  const gridOutputs = bestEval.gridOutputs;

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
    `[alcor-router] SDK quote produced ${splits.length} split(s) winner=step${bestGrid?.step ?? "?"} grids=${JSON.stringify(gridOutputs)}${formatSdkDiagnostics(diagnostics)}`,
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
