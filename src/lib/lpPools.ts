// CHEESEAnal — shared definition of the tracked liquidity pools of a base token
// (CHEESE or HOLE) and the pure aggregation used to turn exchange data into a
// snapshot.
//
// This module is imported both by the app (src/hooks/useLpHistory.ts, the
// CHEESEAnal page) and by the standalone sampler (scripts/lp-history/sample.ts)
// that runs under Bun in GitHub Actions, so it must stay dependency-free.

export const CHEESE_SYMBOL = 'CHEESE';
export const CHEESE_CONTRACT = 'cheeseburger';

/** A token CHEESEAnal can track liquidity for. */
export interface LpToken {
  symbol: string;
  contract: string;
}

export const CHEESE_TOKEN: LpToken = { symbol: CHEESE_SYMBOL, contract: CHEESE_CONTRACT };
export const HOLE_TOKEN: LpToken = { symbol: 'HOLE', contract: 'hole.cheese' };

/** Which recorded history set the page is showing. */
export type LpTokenKey = 'cheese' | 'hole';

export interface LpTokenConfig extends LpToken {
  key: LpTokenKey;
  /** Sub-path of the recorded data for this token ('' = the original files). */
  dataPath: string;
}

export const LP_TOKENS: LpTokenConfig[] = [
  { key: 'cheese', ...CHEESE_TOKEN, dataPath: '' },
  { key: 'hole', ...HOLE_TOKEN, dataPath: 'hole' },
];

export function lpTokenConfig(key: LpTokenKey): LpTokenConfig {
  return LP_TOKENS.find((t) => t.key === key) ?? LP_TOKENS[0];
}


/** Exchanges CHEESEAnal reads liquidity from. */
export type LpVenue = 'alcor' | 'taco' | 'defibox';

export const LP_VENUES: LpVenue[] = ['alcor', 'taco', 'defibox'];

export const LP_VENUE_LABELS: Record<LpVenue, string> = {
  alcor: 'Alcor',
  taco: 'Taco',
  defibox: 'Defibox',
};

/**
 * Untracked pairs are only recorded once they hold more than this in USD.
 * Tracked pairs are always recorded, however small — the floor must never be
 * applied to them, or recorded days silently lose pools the live view shows.
 */
export const MIN_TRACKED_POOL_USD = 100;

/** Never record more than this many extra (untracked) pairs per venue. */
export const MAX_EXTRA_PAIRS_PER_VENUE = 12;

/** One tracked pair: CHEESE against the token below, across every pool of it. */
export interface TrackedPair {
  /** Pair-level key: `${symbol.toLowerCase()}-${contract}`. */
  key: string;
  /** Paired token symbol. */
  symbol: string;
  /** Paired token contract. */
  contract: string;
  /** Display label, e.g. "CHEESE / WAX". */
  label: string;
}

/** A pair on one specific venue — the unit CHEESEAnal stores and charts. */
export interface VenuePair extends TrackedPair {
  venue: LpVenue;
  /** Venue-independent pair key, e.g. `wax-eosio.token`. */
  pairKey: string;
}

export function pairFor(symbol: string, contract: string, base: LpToken = CHEESE_TOKEN): TrackedPair {
  return {
    key: `${symbol.toLowerCase()}-${contract}`,
    symbol: symbol.toUpperCase(),
    contract,
    label: `${base.symbol} / ${symbol.toUpperCase()}`,
  };
}

/** Scope a pair to a venue. Stored keys look like `taco:wax-eosio.token`. */
export function venuePair(venue: LpVenue, base: TrackedPair): VenuePair {
  return { ...base, venue, pairKey: base.key, key: `${venue}:${base.key}` };
}

/** The pairs CHEESEAnal always records, on every venue that lists them. */
export const TRACKED_LP_PAIRS: TrackedPair[] = [
  pairFor('WAX', 'eosio.token'),
  pairFor('WAXUSDC', 'eth.token'),
  pairFor('WAXWBTC', 'eth.token'),
  pairFor('HOLE', 'hole.cheese'),
  pairFor('LSWAX', 'token.fusion'),
  pairFor('LSW', 'lsw.alcor'),
  pairFor('WAXWETH', 'eth.token'),
];

export function findTrackedPair(key: string): TrackedPair | undefined {
  return TRACKED_LP_PAIRS.find((p) => p.key === key);
}

export function isTrackedPairKey(pairKey: string): boolean {
  return TRACKED_LP_PAIRS.some((p) => p.key === pairKey);
}

/* ------------------------------------------------------------------ raw API */

export interface RawPoolToken {
  symbol?: string;
  contract?: string;
  /** Whole tokens held by the pool, as Alcor reports it. */
  quantity?: number;
}

export interface RawPool {
  id: number;
  fee?: number;
  active?: number | boolean;
  /** Current tick of the pool — the price, in tick space. */
  tick?: number;
  tokenA?: RawPoolToken;
  tokenB?: RawPoolToken;
  tvlUSD?: number;
  liquidity?: string | number;
  /** Price of tokenA expressed in tokenB. */
  priceA?: number;
  /** Price of tokenB expressed in tokenA. */
  priceB?: number;
  /** Alcor's rolling 24h volume of tokenA. */
  volumeA24?: number;
  /** Alcor's rolling 24h volume of tokenB. */
  volumeB24?: number;
  /** Alcor's rolling 24h volume in USD. */
  volumeUSD24?: number;
}

export interface RawPosition {
  owner?: string;
  liquidity?: string | number;
  closed?: boolean;
  /** Alcor's own claim about the position being in range — only a last resort. */
  inRange?: boolean;
  /** Lower tick of the position's range. */
  tickLower?: number;
  /** Upper tick of the position's range. */
  tickUpper?: number;
  /** Current USD value of the position — what Alcor's own UI shows. */
  totalValue?: number;
  /** USD value at deposit time; only a fallback, it drifts. */
  depositedUSDTotal?: number;
  /** Token amounts as assets, e.g. "32061.4566 CHEESE". */
  amountA?: string | number;
  amountB?: string | number;
}

/* ------------------------------------------------------------- stored shapes */

/** One position's recorded price range, for the in-range hover detail. */
export interface LpPositionRange {
  /** CHEESE price in the paired token at the low edge of the range. */
  lo?: number;
  /** CHEESE price in the paired token at the high edge of the range. */
  hi?: number;
  /** Whether the position was in range at this snapshot. */
  in: 0 | 1;
  /** Set when the range spans effectively every price (a full-range position). */
  full?: 1;
}

/** One account's aggregated liquidity in a single pair on a single day. */
export interface LpProviderRow {
  /** Account name. */
  a: string;
  /** Current USD value of the account's open positions. */
  usd: number;
  /** CHEESE held inside those positions. */
  cheese: number;
  /** Paired token held inside those positions. */
  paired: number;
  /** Number of open positions. */
  pos: number;
  /** How many of those positions are currently in range. */
  inRange: number;
  /** Per-position ranges, newest snapshots only (older day files omit it). */
  ranges?: LpPositionRange[];
}

/** One pair's totals plus every provider, for a single day. */
export interface LpPoolSnapshot {
  /** Venue-scoped key, e.g. `alcor:wax-eosio.token`. */
  key: string;
  venue: LpVenue;
  /** Venue-independent pair key, e.g. `wax-eosio.token`. */
  pairKey: string;
  symbol: string;
  contract: string;
  label: string;
  /** Pool ids (Alcor) or share-token symbols (Taco / Defibox). */
  poolIds: (number | string)[];
  usd: number;
  cheese: number;
  paired: number;
  accounts: number;
  positions: number;
  /** CHEESE price in the paired token, from the deepest pool of the pair. */
  priceInPaired?: number;
  /** The same price converted to USD. */
  priceUsd?: number;
  /** Rolling 24h trading volume in USD (Alcor only, recorded once per UTC day). */
  volumeUsd24?: number;
  /** Rolling 24h trading volume of the CHEESE leg (Alcor only). */
  volumeCheese24?: number;
  /** Current tick of the deepest pool at snapshot time (Alcor only). */
  tick?: number;
  /** How many positions had Alcor's own in-range flag contradicting the recorded data. */
  rangeMismatch?: number;
  providers: LpProviderRow[];
}

/** A full snapshot file stored on the data branch. */
export interface LpDayFile {
  /** Snapshot key — a UTC 12h slot `YYYY-MM-DDTHH`, or a legacy UTC day `YYYY-MM-DD`. */
  date: string;
  /** Sample time, epoch ms. */
  t: number;
  /** USD price of 1 CHEESE at sample time, when available. */
  cheeseUsd?: number;
  pools: LpPoolSnapshot[];
  /** Venues that could not be read for this snapshot. */
  partial?: LpVenue[];
}

/** Pool-level totals only — the fast series used for charts. */
export interface LpIndexPool {
  key: string;
  venue: LpVenue;
  pairKey: string;
  symbol: string;
  usd: number;
  cheese: number;
  paired: number;
  accounts: number;
  positions: number;
  priceInPaired?: number;
  priceUsd?: number;
  /** Rolling 24h trading volume in USD, when recorded for this snapshot. */
  volumeUsd24?: number;
  /** Rolling 24h trading volume of the CHEESE leg, when recorded. */
  volumeCheese24?: number;
}

export interface LpIndexDay {
  date: string;
  t: number;
  cheeseUsd?: number;
  pools: LpIndexPool[];
  /** Providers deduplicated across every pool in the day. */
  uniqueAccounts?: number;
  /** Providers deduplicated within each venue, so a venue filter stays honest. */
  uniqueByVenue?: Partial<Record<LpVenue, number>>;
  partial?: LpVenue[];
}

export interface LpIndexFile {
  updatedAt: number;
  days: LpIndexDay[];
}

/* ---------------------------------------------------------------- utilities */

/** UTC calendar day of an epoch-ms timestamp, `YYYY-MM-DD`. */
export function utcDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * 12-hour sampling slot of an epoch-ms timestamp, `YYYY-MM-DDTHH` (00 or 12).
 * LP snapshots are keyed by slot so two snapshots per UTC day can coexist.
 * Slot keys sort lexicographically, and a legacy `YYYY-MM-DD` day key sorts
 * before either slot of the same day.
 */
export function utcSlot(t: number): string {
  const iso = new Date(t).toISOString();
  return `${iso.slice(0, 10)}T${Number(iso.slice(11, 13)) < 12 ? '00' : '12'}`;
}

/**
 * Recorded snapshot closest to 24 hours before `currentT`. Used for true 24h
 * comparisons with twice-daily snapshots. Returns null when every recorded
 * entry is less than 12h older than `currentT` — too recent for a meaningful
 * 24h compare, so callers should show no change rather than a ~12h one.
 */
export function dayAbout24hBefore(days: LpIndexDay[], currentT: number): LpIndexDay | null {
  const target = currentT - 24 * 60 * 60_000;
  let best: LpIndexDay | null = null;
  let bestDist = Infinity;
  for (const day of days) {
    if (day.t >= currentT) continue;
    const dist = Math.abs(day.t - target);
    if (dist < bestDist) {
      best = day;
      bestDist = dist;
    }
  }
  if (!best || currentT - best.t < 12 * 60 * 60_000) return null;
  return best;
}

export function round(value: number, decimals: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : 0;
}

/** Numeric part of an asset string such as "1498.27295449 WAX". */
export function assetAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value ?? '').trim().split(' ')[0]);
  return Number.isFinite(n) ? n : 0;
}

/** Symbol part of an asset string, upper-cased. */
export function assetSymbol(value: unknown): string {
  const parts = String(value ?? '').trim().split(' ');
  return (parts[1] ?? '').toUpperCase();
}

function tokenMatches(token: RawPoolToken | undefined, symbol: string, contract: string): boolean {
  return (
    (token?.symbol ?? '').toUpperCase() === symbol.toUpperCase() &&
    (token?.contract ?? '') === contract
  );
}

/**
 * Every active pool (all fee tiers) of the base token against `target`, sorted
 * by id so stored `poolIds` stay stable between days.
 */
export function poolsForPair(
  pools: RawPool[],
  target: TrackedPair,
  base: LpToken = CHEESE_TOKEN,
): RawPool[] {
  return pools
    .filter((pool) => {
      if (pool.active === 0 || pool.active === false) return false;
      const baseA = tokenMatches(pool.tokenA, base.symbol, base.contract);
      const baseB = tokenMatches(pool.tokenB, base.symbol, base.contract);
      if (!baseA && !baseB) return false;
      const other = baseA ? pool.tokenB : pool.tokenA;
      return tokenMatches(other, target.symbol, target.contract);
    })
    .sort((x, y) => x.id - y.id);
}

/** True when the base token sits on the A side (so amountA is the base leg). */
export function cheeseIsTokenA(pool: RawPool, base: LpToken = CHEESE_TOKEN): boolean {
  return tokenMatches(pool.tokenA, base.symbol, base.contract);
}

/**
 * Rolling 24h volume of a pair, summed across its fee tiers. Alcor publishes
 * this directly; Defibox publishes its own figure and Taco's is added up from
 * its swap records (both handled in lpVenues).
 * Returns `{}` when the payload has no usable volume figures.
 */
export function alcorPairVolume(pools: RawPool[], base: LpToken = CHEESE_TOKEN): {
  volumeUsd24?: number;
  volumeCheese24?: number;
} {
  let usdTotal = 0;
  let cheeseTotal = 0;
  let sawUsd = false;
  let sawCheese = false;

  for (const pool of pools) {
    const usdVolume = Number(pool.volumeUSD24);
    if (Number.isFinite(usdVolume) && usdVolume >= 0) {
      usdTotal += usdVolume;
      sawUsd = true;
    }
    const raw = cheeseIsTokenA(pool, base) ? pool.volumeA24 : pool.volumeB24;
    const cheeseVolume = Number(raw);
    if (Number.isFinite(cheeseVolume) && cheeseVolume >= 0) {
      cheeseTotal += cheeseVolume;
      sawCheese = true;
    }
  }

  return {
    ...(sawUsd ? { volumeUsd24: round(usdTotal, 4) } : {}),
    ...(sawCheese ? { volumeCheese24: round(cheeseTotal, 4) } : {}),
  };
}

/**
 * Every pair of the base token listed on Alcor, keyed by paired token, with the
 * summed TVL of its fee tiers. Used to decide which pairs are worth recording.
 *
 * TVL is derived from the pool reserves and the given USD prices — Alcor's own
 * `tvlUSD` is not trustworthy (it reports 0 for real pools, e.g. HOLE/CHEESE
 * pool 11051 with ~$2,300 of positions). Alcor's figure is only a fallback for
 * tokens with no known USD price.
 */
export function alcorCheesePairs(
  pools: RawPool[],
  base: LpToken = CHEESE_TOKEN,
  prices?: ReadonlyMap<string, number>,
): { pair: TrackedPair; tvlUsd: number }[] {
  const priceOf = (token: RawPoolToken | undefined): number | undefined => {
    if (!token?.symbol || !token.contract) return undefined;
    const price = prices?.get(`${token.symbol.toUpperCase()}-${token.contract}`);
    return price && price > 0 ? price : undefined;
  };
  const poolTvlUsd = (pool: RawPool): number => {
    const a = priceOf(pool.tokenA);
    const b = priceOf(pool.tokenB);
    const qtyA = Number(pool.tokenA?.quantity ?? 0);
    const qtyB = Number(pool.tokenB?.quantity ?? 0);
    let derived = 0;
    let priced = false;
    if (a !== undefined && qtyA > 0) { derived += qtyA * a; priced = true; }
    if (b !== undefined && qtyB > 0) { derived += qtyB * b; priced = true; }
    if (priced) return derived;
    return Number(pool.tvlUSD ?? 0);
  };
  const byPair = new Map<string, { pair: TrackedPair; tvlUsd: number }>();
  for (const pool of pools) {
    if (pool.active === 0 || pool.active === false) continue;
    const baseA = tokenMatches(pool.tokenA, base.symbol, base.contract);
    const baseB = tokenMatches(pool.tokenB, base.symbol, base.contract);
    if (!baseA && !baseB) continue;
    const other = baseA ? pool.tokenB : pool.tokenA;
    const symbol = (other?.symbol ?? '').toUpperCase();
    const contract = other?.contract ?? '';
    if (!symbol || !contract) continue;
    const pair = pairFor(symbol, contract, base);
    const entry = byPair.get(pair.key) ?? { pair, tvlUsd: 0 };
    entry.tvlUsd += poolTvlUsd(pool);
    byPair.set(pair.key, entry);
  }
  return [...byPair.values()];
}

/**
 * Which pairs to record for one venue: every always-tracked pair that exists
 * there, plus the largest other pairs above the USD floor. Tokens without an
 * explicit tracked list (HOLE) pass `isTracked: () => false` so every recorded
 * pair has to clear the floor on its own.
 */
export function selectVenuePairs<T extends { pair: TrackedPair; tvlUsd: number }>(
  candidates: T[],
  minUsd = MIN_TRACKED_POOL_USD,
  maxExtra = MAX_EXTRA_PAIRS_PER_VENUE,
  isTracked: (pairKey: string) => boolean = isTrackedPairKey,
): T[] {
  const tracked = candidates.filter((c) => isTracked(c.pair.key));
  const extra = candidates
    .filter((c) => !isTracked(c.pair.key) && c.tvlUsd > minUsd)
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, maxExtra);
  return [...tracked, ...extra];
}

/**
 * USD value of a position holding both legs. When the paired token has no known
 * USD price the CHEESE leg is doubled, which is what a balanced constant-product
 * pool implies.
 */
export function positionUsdValue(
  cheese: number,
  paired: number,
  cheeseUsd?: number,
  pairedUsd?: number,
): number {
  if (cheeseUsd && cheeseUsd > 0 && pairedUsd && pairedUsd > 0) {
    return cheese * cheeseUsd + paired * pairedUsd;
  }
  if (cheeseUsd && cheeseUsd > 0) return cheese * cheeseUsd * 2;
  if (pairedUsd && pairedUsd > 0) return paired * pairedUsd * 2;
  return 0;
}

/* -------------------------------------------------------- in-range resolution */

/** Ticks beyond this are Alcor's full-range sentinels — no meaningful price edge. */
const FULL_RANGE_TICK = 400_000;

/**
 * Is the pool's price inside the position's own range?
 *
 * Returns null when the snapshot has no usable ticks (older day files, or an
 * API row that omitted them).
 */
export function tickInRange(
  poolTick: number | undefined,
  tickLower: number | undefined,
  tickUpper: number | undefined,
): boolean | null {
  const t = Number(poolTick);
  const lo = Number(tickLower);
  const hi = Number(tickUpper);
  if (![t, lo, hi].every((v) => Number.isFinite(v))) return null;
  if (!(hi > lo)) return null;
  return t >= lo && t < hi;
}

/**
 * A position sitting in range always holds both tokens; one holding a single
 * token cannot be in range. Two empty legs prove nothing.
 */
export function balanceInRange(cheese: number, paired: number): boolean | null {
  const hasCheese = cheese > 0;
  const hasPaired = paired > 0;
  if (hasCheese && hasPaired) return true;
  if (hasCheese || hasPaired) return false;
  return null;
}

/**
 * Decide whether one position was in range, preferring the recorded ticks, then
 * the token balances, and only falling back to Alcor's own flag when neither is
 * available. `mismatch` marks rows where Alcor's flag disagrees with the facts.
 */
export function resolveInRange(args: {
  poolTick?: number;
  tickLower?: number;
  tickUpper?: number;
  cheese: number;
  paired: number;
  flag?: boolean;
}): { inRange: boolean; mismatch: boolean } {
  const byTick = tickInRange(args.poolTick, args.tickLower, args.tickUpper);
  const byBalance = balanceInRange(args.cheese, args.paired);
  const resolved = byTick ?? byBalance ?? args.flag === true;
  const flagKnown = typeof args.flag === 'boolean';
  const factKnown = byTick !== null || byBalance !== null;
  return { inRange: resolved, mismatch: flagKnown && factKnown && args.flag !== resolved };
}

/**
 * CHEESE price in the paired token at a given tick, scaled off the pool's own
 * current price so no token precisions are needed. Undefined when the pool row
 * lacks the data, or when the tick is a full-range sentinel.
 */
function cheesePriceAtTick(
  pool: RawPool,
  cheeseSideIsA: boolean,
  tick: number,
): number | undefined {
  const poolTick = Number(pool.tick);
  // priceA/priceB follow the pool's own token order, so priceA is already the
  // price of token A expressed in token B — the same orientation as the ticks.
  const reference = Number(pool.priceA);
  if (!Number.isFinite(poolTick) || !Number.isFinite(reference) || !(reference > 0)) return undefined;
  if (Math.abs(tick) >= FULL_RANGE_TICK) return undefined;

  const scale = reference / Math.pow(1.0001, poolTick);
  const priceAinB = scale * Math.pow(1.0001, tick);
  if (!Number.isFinite(priceAinB) || !(priceAinB > 0)) return undefined;
  const price = cheeseSideIsA ? priceAinB : 1 / priceAinB;
  if (!Number.isFinite(price) || !(price > 0)) return undefined;
  return round(price, 12);
}

/** Recorded price range of one position, oriented as CHEESE price in the pair. */
function positionRange(
  pool: RawPool,
  cheeseSideIsA: boolean,
  row: RawPosition,
  inRange: boolean,
): LpPositionRange {
  const lower = Number(row.tickLower);
  const upper = Number(row.tickUpper);
  const flag: 0 | 1 = inRange ? 1 : 0;
  if (
    !Number.isFinite(lower) ||
    !Number.isFinite(upper) ||
    Math.abs(lower) >= FULL_RANGE_TICK ||
    Math.abs(upper) >= FULL_RANGE_TICK
  ) {
    return { in: flag, full: 1 };
  }
  const a = cheesePriceAtTick(pool, cheeseSideIsA, lower);
  const b = cheesePriceAtTick(pool, cheeseSideIsA, upper);
  if (a === undefined || b === undefined) return { in: flag };
  return { lo: Math.min(a, b), hi: Math.max(a, b), in: flag };
}

function finaliseProviders(byAccount: Map<string, LpProviderRow>): LpProviderRow[] {
  return [...byAccount.values()]
    .map((row) => ({
      ...row,
      usd: round(row.usd, 4),
      cheese: round(row.cheese, 4),
      paired: round(row.paired, 8),
    }))
    .sort((x, y) => y.usd - x.usd || x.a.localeCompare(y.a));
}

/**
 * Aggregate the open positions of one Alcor pair into a day snapshot.
 *
 * Open positions count whether or not they are in range: the funds sit in the
 * pool either way, which is what Alcor's own totals reflect. USD value comes
 * from each position's current `totalValue`, falling back to `depositedUSDTotal`
 * only when the API omits it. Positions with no liquidity, closed positions and
 * ownerless rows are dropped.
 */
export function buildPoolSnapshot(
  target: VenuePair,
  pools: { pool: RawPool; positions: RawPosition[] }[],
  prices: { cheeseUsd?: number; pairedUsd?: number } = {},
  base: LpToken = CHEESE_TOKEN,
): LpPoolSnapshot {
  const byAccount = new Map<string, LpProviderRow>();
  let positions = 0;
  let usdTotal = 0;
  let cheeseTotal = 0;
  let pairedTotal = 0;
  let mismatches = 0;

  for (const { pool, positions: rows } of pools) {
    const cheeseFirst = cheeseIsTokenA(pool, base);

    for (const row of rows) {
      const account = (row.owner ?? '').trim();
      if (!account) continue;
      if (row.closed === true) continue;
      if (!(Number(row.liquidity ?? 0) > 0)) continue;

      const usd = Number(row.totalValue ?? row.depositedUSDTotal ?? 0);
      const amountA = assetAmount(row.amountA);
      const amountB = assetAmount(row.amountB);
      // Prefer the asset symbol when present — it is authoritative about which
      // leg is the base token even if a pool row came back in an odd order.
      const symbolA = assetSymbol(row.amountA);
      const cheeseSideIsA = symbolA ? symbolA === base.symbol.toUpperCase() : cheeseFirst;
      const cheese = cheeseSideIsA ? amountA : amountB;
      const paired = cheeseSideIsA ? amountB : amountA;

      if (!(usd > 0) && !(cheese > 0) && !(paired > 0)) continue;

      positions += 1;
      usdTotal += Math.max(0, usd);
      cheeseTotal += Math.max(0, cheese);
      pairedTotal += Math.max(0, paired);

      const entry = byAccount.get(account) ?? {
        a: account,
        usd: 0,
        cheese: 0,
        paired: 0,
        pos: 0,
        inRange: 0,
      };
      entry.usd += Math.max(0, usd);
      entry.cheese += Math.max(0, cheese);
      entry.paired += Math.max(0, paired);
      entry.pos += 1;
      const verdict = resolveInRange({
        poolTick: pool.tick,
        tickLower: row.tickLower,
        tickUpper: row.tickUpper,
        cheese,
        paired,
        flag: row.inRange,
      });
      if (verdict.inRange) entry.inRange += 1;
      if (verdict.mismatch) mismatches += 1;
      (entry.ranges ??= []).push(positionRange(pool, cheeseSideIsA, row, verdict.inRange));
      byAccount.set(account, entry);
    }
  }

  const providers = finaliseProviders(byAccount);

  // Base-token price from the deepest fee tier of the pair.
  const deepest = [...pools].sort(
    (a, b) => Number(b.pool.liquidity ?? 0) - Number(a.pool.liquidity ?? 0),
  )[0]?.pool;
  let priceInPaired: number | undefined;
  if (deepest) {
    const raw = cheeseIsTokenA(deepest, base) ? deepest.priceA : deepest.priceB;
    if (Number.isFinite(Number(raw)) && Number(raw) > 0) priceInPaired = round(Number(raw), 12);
  }
  const priceUsd = derivePriceUsd(priceInPaired, prices);

  return {
    key: target.key,
    venue: target.venue,
    pairKey: target.pairKey,
    symbol: target.symbol,
    contract: target.contract,
    label: target.label,
    poolIds: pools.map(({ pool }) => pool.id),
    usd: round(usdTotal, 4),
    cheese: round(cheeseTotal, 4),
    paired: round(pairedTotal, 8),
    accounts: providers.length,
    positions,
    ...(priceInPaired !== undefined ? { priceInPaired } : {}),
    ...(priceUsd !== undefined ? { priceUsd } : {}),
    providers,
  };
}

/**
 * USD equivalent of this pair's own CHEESE price. Deliberately has no global
 * fallback: borrowing the market CHEESE/USD price would make every pool show
 * the same number, which hides what the pair itself is actually pricing at.
 */
function derivePriceUsd(
  priceInPaired: number | undefined,
  prices: { cheeseUsd?: number; pairedUsd?: number },
): number | undefined {
  if (priceInPaired !== undefined && prices.pairedUsd && prices.pairedUsd > 0) {
    return round(priceInPaired * prices.pairedUsd, 10);
  }
  return undefined;
}

/* ------------------------------------------------- constant-product venues */

/** One constant-product pool (Taco / Defibox) with its share holders. */
export interface AmmPoolInput {
  /** Share-token symbol, used as the stored pool id. */
  id: string;
  reserveCheese: number;
  reservePaired: number;
  totalShares: number;
  holders: { account: string; shares: number }[];
}

/**
 * Aggregate a constant-product pair into a day snapshot. Each provider's
 * holding is `their shares ÷ total shares × reserves`, valued with external
 * token prices (the pool's own ratio is not trusted for valuation because thin
 * pools can sit far from the market price).
 */
export function buildAmmPoolSnapshot(
  target: VenuePair,
  pools: AmmPoolInput[],
  prices: { cheeseUsd?: number; pairedUsd?: number } = {},
): LpPoolSnapshot {
  const byAccount = new Map<string, LpProviderRow>();
  let positions = 0;
  let usdTotal = 0;
  let cheeseTotal = 0;
  let pairedTotal = 0;

  for (const pool of pools) {
    if (!(pool.totalShares > 0)) continue;
    for (const holder of pool.holders) {
      const account = (holder.account ?? '').trim();
      if (!account || !(holder.shares > 0)) continue;
      const share = Math.min(1, holder.shares / pool.totalShares);
      const cheese = pool.reserveCheese * share;
      const paired = pool.reservePaired * share;
      if (!(cheese > 0) && !(paired > 0)) continue;
      const usd = positionUsdValue(cheese, paired, prices.cheeseUsd, prices.pairedUsd);

      positions += 1;
      usdTotal += usd;
      cheeseTotal += cheese;
      pairedTotal += paired;

      const entry = byAccount.get(account) ?? {
        a: account,
        usd: 0,
        cheese: 0,
        paired: 0,
        pos: 0,
        inRange: 0,
      };
      entry.usd += usd;
      entry.cheese += cheese;
      entry.paired += paired;
      entry.pos += 1;
      // Constant-product positions are always across the full range.
      entry.inRange += 1;
      byAccount.set(account, entry);
    }
  }

  const providers = finaliseProviders(byAccount);

  const deepest = [...pools].sort((a, b) => b.reserveCheese - a.reserveCheese)[0];
  let priceInPaired: number | undefined;
  if (deepest && deepest.reserveCheese > 0 && deepest.reservePaired > 0) {
    priceInPaired = round(deepest.reservePaired / deepest.reserveCheese, 12);
  }
  const priceUsd = derivePriceUsd(priceInPaired, prices);

  return {
    key: target.key,
    venue: target.venue,
    pairKey: target.pairKey,
    symbol: target.symbol,
    contract: target.contract,
    label: target.label,
    poolIds: pools.map((p) => p.id),
    usd: round(usdTotal, 4),
    cheese: round(cheeseTotal, 4),
    paired: round(pairedTotal, 8),
    accounts: providers.length,
    positions,
    ...(priceInPaired !== undefined ? { priceInPaired } : {}),
    ...(priceUsd !== undefined ? { priceUsd } : {}),
    providers,
  };
}

/* ----------------------------------------------------------- venue filtering */

/** Keep only the pools of one venue (or all of them). */
export function poolsForVenue<T extends { venue: LpVenue }>(
  pools: T[],
  venue: LpVenue | 'all',
): T[] {
  return venue === 'all' ? pools : pools.filter((p) => p.venue === venue);
}

/** Reduce a day file to the pool-level entry stored in the index. */
export function indexEntryForDay(day: LpDayFile): LpIndexDay {
  const unique = new Set<string>();
  const perVenue = new Map<LpVenue, Set<string>>();
  for (const pool of day.pools) {
    const venueSet = perVenue.get(pool.venue) ?? new Set<string>();
    for (const row of pool.providers) {
      unique.add(row.a);
      venueSet.add(row.a);
    }
    perVenue.set(pool.venue, venueSet);
  }
  const uniqueByVenue: Partial<Record<LpVenue, number>> = {};
  for (const [venue, set] of perVenue) uniqueByVenue[venue] = set.size;
  return {
    date: day.date,
    t: day.t,
    ...(day.cheeseUsd !== undefined ? { cheeseUsd: day.cheeseUsd } : {}),
    ...(day.partial && day.partial.length ? { partial: day.partial } : {}),
    uniqueAccounts: unique.size,
    uniqueByVenue,
    pools: day.pools.map((pool) => ({
      key: pool.key,
      venue: pool.venue,
      pairKey: pool.pairKey,
      symbol: pool.symbol,
      usd: pool.usd,
      cheese: pool.cheese,
      paired: pool.paired,
      accounts: pool.accounts,
      positions: pool.positions,
      ...(pool.priceInPaired !== undefined ? { priceInPaired: pool.priceInPaired } : {}),
      ...(pool.priceUsd !== undefined ? { priceUsd: pool.priceUsd } : {}),
      ...(pool.volumeUsd24 !== undefined ? { volumeUsd24: pool.volumeUsd24 } : {}),
      ...(pool.volumeCheese24 !== undefined ? { volumeCheese24: pool.volumeCheese24 } : {}),
    })),
  };
}

/**
 * Merge a snapshot into an index, replacing any existing entry with the same
 * key. Keys are 12h slots (`YYYY-MM-DDTHH`) — 1600 entries ≈ 800 days.
 */
export function mergeIndexDay(days: LpIndexDay[], day: LpIndexDay, maxDays = 1600): LpIndexDay[] {
  const kept = days.filter((d) => d && d.date && d.date !== day.date);
  return [...kept, day].sort((x, y) => x.date.localeCompare(y.date)).slice(-maxDays);
}
