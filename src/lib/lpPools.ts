// CHEESELytics — shared definition of the tracked CHEESE liquidity pools and the
// pure aggregation used to turn Alcor position rows into a daily snapshot.
//
// This module is imported both by the app (src/hooks/useLpHistory.ts, the
// CHEESELytics page) and by the standalone sampler (scripts/lp-history/sample.ts)
// that runs under Bun in GitHub Actions, so it must stay dependency-free.

export const CHEESE_SYMBOL = 'CHEESE';
export const CHEESE_CONTRACT = 'cheeseburger';

/** One tracked pair: CHEESE against the token below, across every fee tier. */
export interface TrackedPair {
  /** Stable key, also used in stored data: `${symbol.toLowerCase()}-${contract}`. */
  key: string;
  /** Paired token symbol. */
  symbol: string;
  /** Paired token contract. */
  contract: string;
  /** Display label, e.g. "CHEESE / WAX". */
  label: string;
}

function pair(symbol: string, contract: string): TrackedPair {
  return {
    key: `${symbol.toLowerCase()}-${contract}`,
    symbol,
    contract,
    label: `${CHEESE_SYMBOL} / ${symbol}`,
  };
}

/** The pools CHEESELytics snapshots once a day. */
export const TRACKED_LP_PAIRS: TrackedPair[] = [
  pair('WAX', 'eosio.token'),
  pair('WAXUSDC', 'eth.token'),
  pair('WAXWBTC', 'eth.token'),
  pair('HOLE', 'hole.cheese'),
  pair('LSWAX', 'token.fusion'),
  pair('LSW', 'lsw.alcor'),
  pair('WAXWETH', 'eth.token'),
];

export function findTrackedPair(key: string): TrackedPair | undefined {
  return TRACKED_LP_PAIRS.find((p) => p.key === key);
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
  key: string;
  symbol: string;
  contract: string;
  label: string;
  poolIds: number[];
  usd: number;
  cheese: number;
  paired: number;
  accounts: number;
  positions: number;
  providers: LpProviderRow[];
}

/** A full day file stored on the data branch. */
export interface LpDayFile {
  /** UTC day, `YYYY-MM-DD`. */
  date: string;
  /** Sample time, epoch ms. */
  t: number;
  /** USD price of 1 CHEESE at sample time, when available. */
  cheeseUsd?: number;
  pools: LpPoolSnapshot[];
}

/** Pool-level totals only — the fast series used for charts. */
export interface LpIndexPool {
  key: string;
  usd: number;
  cheese: number;
  paired: number;
  accounts: number;
  positions: number;
}

export interface LpIndexDay {
  date: string;
  t: number;
  cheeseUsd?: number;
  pools: LpIndexPool[];
  /**
   * Providers deduplicated across every pool in the day. Older index entries
   * predate this field — callers should fall back to summing pool accounts.
   */
  uniqueAccounts?: number;
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
 * Aggregate the open positions of one pair into a day snapshot.
 *
 * Open positions count whether or not they are in range: the funds sit in the
 * pool either way, which is what Alcor's own totals reflect. USD value comes
 * from each position's current `totalValue`, falling back to `depositedUSDTotal`
 * only when the API omits it. Positions with no liquidity, closed positions and
 * ownerless rows are dropped.
 */
export function buildPoolSnapshot(
  target: TrackedPair,
  pools: { pool: RawPool; positions: RawPosition[] }[],
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

  const providers = [...byAccount.values()]
    .map((row) => ({
      ...row,
      usd: round(row.usd, 4),
      cheese: round(row.cheese, 4),
      paired: round(row.paired, 8),
    }))
    .sort((x, y) => y.usd - x.usd || x.a.localeCompare(y.a));

  return {
    key: target.key,
    symbol: target.symbol,
    contract: target.contract,
    label: target.label,
    poolIds: pools.map(({ pool }) => pool.id),
    usd: round(usdTotal, 4),
    cheese: round(cheeseTotal, 4),
    paired: round(pairedTotal, 8),
    accounts: providers.length,
    positions,
    providers,
  };
}

/** Reduce a day file to the pool-level entry stored in the index. */
export function indexEntryForDay(day: LpDayFile): LpIndexDay {
  const unique = new Set<string>();
  for (const pool of day.pools) for (const row of pool.providers) unique.add(row.a);
  return {
    date: day.date,
    t: day.t,
    ...(day.cheeseUsd !== undefined ? { cheeseUsd: day.cheeseUsd } : {}),
    uniqueAccounts: unique.size,
    pools: day.pools.map((pool) => ({
      key: pool.key,
      usd: pool.usd,
      cheese: pool.cheese,
      paired: pool.paired,
      accounts: pool.accounts,
      positions: pool.positions,
    })),
  };
}

/** Merge a day into an index, replacing any existing entry for the same date. */
export function mergeIndexDay(days: LpIndexDay[], day: LpIndexDay, maxDays = 800): LpIndexDay[] {
  const kept = days.filter((d) => d && d.date && d.date !== day.date);
  return [...kept, day].sort((x, y) => x.date.localeCompare(y.date)).slice(-maxDays);
}
