// CHEESEAnal — shared definition of the tracked CHEESE liquidity pools and the
// pure aggregation used to turn exchange data into a daily snapshot.
//
// This module is imported both by the app (src/hooks/useLpHistory.ts, the
// CHEESEAnal page) and by the standalone sampler (scripts/lp-history/sample.ts)
// that runs under Bun in GitHub Actions, so it must stay dependency-free.

export const CHEESE_SYMBOL = 'CHEESE';
export const CHEESE_CONTRACT = 'cheeseburger';

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

export function pairFor(symbol: string, contract: string): TrackedPair {
  return {
    key: `${symbol.toLowerCase()}-${contract}`,
    symbol: symbol.toUpperCase(),
    contract,
    label: `${CHEESE_SYMBOL} / ${symbol.toUpperCase()}`,
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
}

export interface RawPool {
  id: number;
  fee?: number;
  active?: number | boolean;
  tokenA?: RawPoolToken;
  tokenB?: RawPoolToken;
  tvlUSD?: number;
  liquidity?: string | number;
  /** Price of tokenA expressed in tokenB. */
  priceA?: number;
  /** Price of tokenB expressed in tokenA. */
  priceB?: number;
}

export interface RawPosition {
  owner?: string;
  liquidity?: string | number;
  closed?: boolean;
  inRange?: boolean;
  /** Current USD value of the position — what Alcor's own UI shows. */
  totalValue?: number;
  /** USD value at deposit time; only a fallback, it drifts. */
  depositedUSDTotal?: number;
  /** Token amounts as assets, e.g. "32061.4566 CHEESE". */
  amountA?: string | number;
  amountB?: string | number;
}

/* ------------------------------------------------------------- stored shapes */

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
 * Every active pool (all fee tiers) of CHEESE against `target`, sorted by id so
 * stored `poolIds` stay stable between days.
 */
export function poolsForPair(pools: RawPool[], target: TrackedPair): RawPool[] {
  return pools
    .filter((pool) => {
      if (pool.active === 0 || pool.active === false) return false;
      const cheeseA = tokenMatches(pool.tokenA, CHEESE_SYMBOL, CHEESE_CONTRACT);
      const cheeseB = tokenMatches(pool.tokenB, CHEESE_SYMBOL, CHEESE_CONTRACT);
      if (!cheeseA && !cheeseB) return false;
      const other = cheeseA ? pool.tokenB : pool.tokenA;
      return tokenMatches(other, target.symbol, target.contract);
    })
    .sort((x, y) => x.id - y.id);
}

/** True when CHEESE sits on the A side of a pool (so amountA is the CHEESE leg). */
export function cheeseIsTokenA(pool: RawPool): boolean {
  return tokenMatches(pool.tokenA, CHEESE_SYMBOL, CHEESE_CONTRACT);
}

/**
 * Every CHEESE pair listed on Alcor, keyed by paired token, with the summed TVL
 * of its fee tiers. Used to decide which untracked pairs are worth recording.
 */
export function alcorCheesePairs(pools: RawPool[]): { pair: TrackedPair; tvlUsd: number }[] {
  const byPair = new Map<string, { pair: TrackedPair; tvlUsd: number }>();
  for (const pool of pools) {
    if (pool.active === 0 || pool.active === false) continue;
    const cheeseA = tokenMatches(pool.tokenA, CHEESE_SYMBOL, CHEESE_CONTRACT);
    const cheeseB = tokenMatches(pool.tokenB, CHEESE_SYMBOL, CHEESE_CONTRACT);
    if (!cheeseA && !cheeseB) continue;
    const other = cheeseA ? pool.tokenB : pool.tokenA;
    const symbol = (other?.symbol ?? '').toUpperCase();
    const contract = other?.contract ?? '';
    if (!symbol || !contract) continue;
    const pair = pairFor(symbol, contract);
    const entry = byPair.get(pair.key) ?? { pair, tvlUsd: 0 };
    entry.tvlUsd += Number(pool.tvlUSD ?? 0);
    byPair.set(pair.key, entry);
  }
  return [...byPair.values()];
}

/**
 * Which pairs to record for one venue: every tracked pair that exists there,
 * plus the largest untracked pairs above the USD floor.
 */
export function selectVenuePairs<T extends { pair: TrackedPair; tvlUsd: number }>(
  candidates: T[],
  minUsd = MIN_TRACKED_POOL_USD,
  maxExtra = MAX_EXTRA_PAIRS_PER_VENUE,
): T[] {
  const tracked = candidates.filter((c) => isTrackedPairKey(c.pair.key));
  const extra = candidates
    .filter((c) => !isTrackedPairKey(c.pair.key) && c.tvlUsd > minUsd)
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
): LpPoolSnapshot {
  const byAccount = new Map<string, LpProviderRow>();
  let positions = 0;
  let usdTotal = 0;
  let cheeseTotal = 0;
  let pairedTotal = 0;

  for (const { pool, positions: rows } of pools) {
    const cheeseFirst = cheeseIsTokenA(pool);
    for (const row of rows) {
      const account = (row.owner ?? '').trim();
      if (!account) continue;
      if (row.closed === true) continue;
      if (!(Number(row.liquidity ?? 0) > 0)) continue;

      const usd = Number(row.totalValue ?? row.depositedUSDTotal ?? 0);
      const amountA = assetAmount(row.amountA);
      const amountB = assetAmount(row.amountB);
      // Prefer the asset symbol when present — it is authoritative about which
      // leg is CHEESE even if a pool row ever came back in an odd order.
      const symbolA = assetSymbol(row.amountA);
      const cheeseSideIsA = symbolA ? symbolA === CHEESE_SYMBOL : cheeseFirst;
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
      if (row.inRange === true) entry.inRange += 1;
      byAccount.set(account, entry);
    }
  }

  const providers = finaliseProviders(byAccount);

  // CHEESE price from the deepest fee tier of the pair.
  const deepest = [...pools].sort(
    (a, b) => Number(b.pool.liquidity ?? 0) - Number(a.pool.liquidity ?? 0),
  )[0]?.pool;
  let priceInPaired: number | undefined;
  if (deepest) {
    const raw = cheeseIsTokenA(deepest) ? deepest.priceA : deepest.priceB;
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
