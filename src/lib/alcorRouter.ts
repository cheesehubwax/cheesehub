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
import type { SwapToken, SwapRoute } from "./swapApi";
import type { ManualAllocation } from "./manualSwap";
import {
  type RawAlcorPool,
  type RawAlcorTick,
  tokenKey,
  buildPool,
  runBestTradeWithSplit,
  toRawAmount,
  formatSdkDiagnostics,
} from "./alcorQuoteCore";
import { runQuote } from "./alcorQuoteRunner";
import { fetchAmmPoolsFor, prefetchAmmIndexes, ammIndexesReady } from "./ammSwapPools";

/** Longest the Alcor quote waits for already-indexed Defibox/Taco pools. */
const AMM_GRACE_MS = 1_200;
import { fetchTableRows } from "./waxRpcFallback";
import { readStatCache, writeStatCache } from "./statCache";
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
    savePoolIndex(data);
    return data;
  })();
  try {
    return await poolsInflight;
  } finally {
    poolsInflight = null;
  }
}

// ----- Saved pool index -----
// A slim copy of the pool list (which pools exist, their tokens, fee and
// liquidity) kept in the browser so a returning visitor can start fetching
// ticks before the ~2 MB live list arrives. Never used for prices.
const POOL_INDEX_KEY = "alcor-pools-index";
const POOL_INDEX_SAVE_EVERY_MS = 10 * 60_000;
let poolIndexSavedAt = 0;

function savePoolIndex(data: RawAlcorPool[]): void {
  if (Date.now() - poolIndexSavedAt < POOL_INDEX_SAVE_EVERY_MS) return;
  poolIndexSavedAt = Date.now();
  const tok = (t: RawAlcorPool["tokenA"]) => ({
    contract: t.contract,
    decimals: t.decimals,
    symbol: t.symbol,
    id: t.id,
  });
  writeStatCache(
    POOL_INDEX_KEY,
    data
      .filter((p) => p.active)
      .map((p) => ({
        id: p.id,
        active: p.active,
        fee: p.fee,
        liquidity: p.liquidity,
        tokenA: tok(p.tokenA),
        tokenB: tok(p.tokenB),
      })),
  );
}

function readSavedPoolIndex(): RawAlcorPool[] | null {
  const saved = readStatCache<RawAlcorPool[]>(POOL_INDEX_KEY);
  return Array.isArray(saved) && saved.length > 0 ? saved : null;
}

/**
 * Warm the tick cache for a token pair before an amount is typed, so the
 * first quote only has to run the search. Best-effort and silent.
 */
export async function prefetchPairPools(tokenIn: SwapToken, tokenOut: SwapToken): Promise<void> {
  prefetchAmmIndexes();
  try {
    const list = poolsCache?.data ?? readSavedPoolIndex() ?? (await fetchAllAlcorPools());
    const relevant = selectRelevantPools(
      list,
      tokenKey(tokenIn.contract, tokenIn.ticker),
      tokenKey(tokenOut.contract, tokenOut.ticker),
      3,
    );
    await mapWithConcurrency(relevant, TICK_CONCURRENCY, (p) =>
      fetchPoolTicksWithRetry(p.id).catch(() => null),
    );
  } catch {
    // Prefetch is a nicety only.
  }
}

// ----- Ticks straight from the chain -----
// The swap.alcor `ticks` table (scoped by pool id) holds exactly the rows the
// Alcor API serves. Used when the API refuses us (429) so a busy Alcor never
// removes a pool from the route search.
const CHAIN_TICKS_PAGE = 1000;
const CHAIN_TICKS_MAX_PAGES = 20;

export async function fetchPoolTicksFromChain(poolId: number): Promise<RawAlcorTick[]> {
  const rows: RawAlcorTick[] = [];
  let lower: string | undefined;
  for (let page = 0; page < CHAIN_TICKS_MAX_PAGES; page++) {
    const res = await fetchTableRows<RawAlcorTick>({
      code: "swap.alcor",
      scope: String(poolId),
      table: "ticks",
      limit: CHAIN_TICKS_PAGE,
      ...(lower ? { lower_bound: lower } : {}),
    });
    rows.push(...res.rows);
    if (!res.more || !res.next_key) return rows;
    lower = res.next_key;
  }
  throw new Error(`Too many tick pages for pool ${poolId}`);
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
  preferChain = false,
): Promise<RawAlcorTick[]> {
  const cached = ticksCache.get(poolId);
  if (cached && Date.now() - cached.at < TICKS_TTL_MS) return cached.data;
  const fromChain = async () => {
    if (signal?.aborted) {
      const err = new Error("aborted");
      (err as any).name = "AbortError";
      throw err;
    }
    const data = await fetchPoolTicksFromChain(poolId);
    ticksCache.set(poolId, { at: Date.now(), data });
    ticksFailCache.delete(poolId);
    return data;
  };
  // While Alcor is rate-limiting us, go straight to the chain.
  if (isAlcorCoolingDown()) return fromChain();
  if (preferChain) {
    try {
      return await fromChain();
    } catch (e) {
      if ((e as any)?.name === "AbortError") throw e;
      // fall through to Alcor
    }
  }
  try {
    return await fetchPoolTicks(poolId, signal);
  } catch (e) {
    if ((e as any)?.name === "AbortError") throw e;
    return fromChain();
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


// Hub tokens that make good intermediate hops on WAX (matches Alcor's routing
// heuristics: only route through liquid, well-known assets).
const HUB_KEYS = new Set([
  "wax-eosio.token",
  "usdt-usdt.alcor",
  "usdc-usdc.alcor",
  "waxusdc-eth.token",
  "waxusdt-eth.token",
  "usdc-tethertether",
  "parausd-parareserves",
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
  "parausd-parareserves",
  "waxwbtc-eth.token",
  "lsw-lsw.alcor",
  "lswax-token.lswax",
  "lswax-token.fusion",
]);

// Controlled first-party exception: Alcor's current best WAX→WAXWETH path uses
// WAX→CHEESE→WAXWETH. Keep this scoped to WAXWETH so WAXWBTC selection remains
// governed by the stable/base hub set above.
function routeCoverageHubKeys(inKey: string, outKey: string): Set<string> {
  if (inKey === "waxweth-eth.token" || outKey === "waxweth-eth.token") {
    return new Set([...ROUTE_COVERAGE_HUB_KEYS, "cheese-cheeseburger"]);
  }
  // HOLE only has liquidity via CHEESE. Allow CHEESE as a coverage hub when
  // HOLE is an endpoint so WAX→HOLE / HOLE→WAX surface the CHEESE-bridged split.
  if (inKey === "hole-hole.cheese" || outKey === "hole-hole.cheese") {
    return new Set([...ROUTE_COVERAGE_HUB_KEYS, "cheese-cheeseburger"]);
  }
  return ROUTE_COVERAGE_HUB_KEYS;
}

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
  const coverageHubKeys = routeCoverageHubKeys(inKey, outKey);
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
      if (!coverageHubKeys.has(intermediate)) return false;
      if (touchesIn && !touchesOut) return pairPools(intermediate, outKey).length > 0;
      if (touchesOut && !touchesIn) return pairPools(inKey, intermediate).length > 0;
      return false;
    })
    .sort((a, b) => {
      const aKey = keyOf(a.tokenA) === inKey || keyOf(a.tokenB) === inKey ? other(a, inKey) : other(a, outKey);
      const bKey = keyOf(b.tokenA) === inKey || keyOf(b.tokenB) === inKey ? other(b, inKey) : other(b, outKey);
      const aHub = coverageHubKeys.has(aKey) ? 0 : 1;
      const bHub = coverageHubKeys.has(bKey) ? 0 : 1;
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


// ----- Pool construction -----


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
  manualAllocations?: ManualAllocation[];
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
    manualAllocations,
  } = args;

  const started = performance.now();

  const inKey = tokenKey(tokenIn.contract, tokenIn.ticker);
  const outKey = tokenKey(tokenOut.contract, tokenOut.ticker);

  // Start fetching ticks straight away from the pool list we already have
  // (in memory, or saved in the browser from an earlier visit), while the
  // fresh pool list downloads in parallel. Live pool state (price, liquidity,
  // current tick) always comes from the fresh list — the saved list is only
  // used to decide which pools are worth fetching ticks for.
  const freshPromise = fetchAllAlcorPools(signal);
  // Defibox / TacoSwap pools for the same pair, read alongside Alcor's. This
  // never throws and is time-boxed, so it can't slow or break the Alcor quote.
  const ammPromise =
    tradeType === "EXACT_INPUT" ? fetchAmmPoolsFor(tokenIn, tokenOut) : Promise.resolve([]);
  const earlyList = poolsCache?.data ?? readSavedPoolIndex();
  const earlyRelevant = earlyList ? selectRelevantPools(earlyList, inKey, outKey, maxHops) : [];

  let tickFailures = 0;
  let rateLimitedTickFailures = 0;
  const tickById = new Map<number, Promise<RawAlcorTick[] | null>>();
  // Spread the fan-out: every third pool is read from the chain first, so
  // Alcor sees fewer requests at once and stops answering 429.
  let fanout = 0;
  const ticksFor = (id: number) => {
    let pr = tickById.get(id);
    if (!pr) {
      const preferChain = fanout++ % 3 === 2;
      pr = fetchPoolTicksWithRetry(id, signal, preferChain).catch((e) => {
        if ((e as any)?.name === "AbortError") throw e;
        tickFailures += 1;
        if (isRateLimitError(e)) rateLimitedTickFailures += 1;
        logger.warn(`alcorTrade: tick fetch failed for pool ${id}`, e);
        return null;
      });
      // Surface aborts only to whoever awaits; never as unhandled rejections.
      pr.catch(() => {});
      tickById.set(id, pr);
    }
    return pr;
  };
  // Bounded fan-out: same concurrency as before.
  const earlyWarm = mapWithConcurrency(earlyRelevant, TICK_CONCURRENCY, (p) => ticksFor(p.id));
  earlyWarm.catch(() => {});

  const allPools = await freshPromise;
  const relevant = selectRelevantPools(allPools, inKey, outKey, maxHops);
  if (relevant.length === 0) return null;

  const tickResults = await mapWithConcurrency(relevant, TICK_CONCURRENCY, async (p) => ({
    p,
    ticks: (await ticksFor(p.id)) ?? ([] as RawAlcorTick[]),
  }));

  // Never hold the Alcor quote long for Defibox/Taco. When their pool lists are
  // already loaded, the live reserve reads take a few hundred ms, so allow a
  // short grace; while the lists are still downloading, don't wait at all.
  const graceMs = ammIndexesReady() ? AMM_GRACE_MS : 0;
  const ammPools = await Promise.race([
    ammPromise,
    new Promise<[]>((resolve) => setTimeout(() => resolve([]), graceMs)),
  ]);

  const fetchMs = Math.round(performance.now() - started);
  const searchStarted = performance.now();
  const quoted = await runQuote({
    pools: tickResults,
    ammPools,
    tokenIn,
    tokenOut,
    amount,
    slippage,
    receiver,
    tradeType,
    maxHops,
    distributionPercent,
    relevantCount: relevant.length,
    tickFailures,
    rateLimitedTickFailures,
    started,
    manualAllocations,
  }, signal);
  if (quoted?.quoteDiagnostics) {
    quoted.quoteDiagnostics.fetchMs = fetchMs;
    quoted.quoteDiagnostics.searchMs = Math.round(performance.now() - searchStarted);
  }
  return quoted;
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

