// CHEESEAnal — readers for the constant-product CHEESE pools on Taco and
// Defibox, plus the USD price table used to value their reserves.
//
// Deliberately self-contained (plain `fetch` only) so the same module runs in
// the browser and under Bun inside the daily sampler.

import {
  CHEESE_CONTRACT,
  CHEESE_SYMBOL,
  MIN_TRACKED_POOL_USD,
  MAX_EXTRA_PAIRS_PER_VENUE,
  assetAmount,
  assetSymbol,
  buildAmmPoolSnapshot,
  pairFor,
  positionUsdValue,
  selectVenuePairs,
  venuePair,
  type AmmPoolInput,
  type LpPoolSnapshot,
  type LpVenue,
  type TrackedPair,
} from './lpPools';

/** Chain RPC hosts that answer browser CORS preflights for POST /v1/chain/*. */
const CHAIN_ENDPOINTS = [
  'https://wax.eosphere.io',
  'https://wax.eosusa.io',
  'https://api.waxsweden.org',
  'https://api.wax.alohaeos.com',
];

/** Light API mirrors — the public source of token holder lists with balances. */
const LIGHT_API_ENDPOINTS = ['https://lightapi.eosamsterdam.net', 'https://wax.light-api.net'];

const ALCOR_API = 'https://wax.alcor.exchange/api/v2';

const TIMEOUT_MS = 20_000;
const HOLDERS_TIMEOUT_MS = 30_000;
const LIGHT_API_MAX = 1000;
/** Cap on the fallback scope sweep so a Light API outage cannot run away. */
const MAX_SWEEP_SCOPES = 4_000;
const SWEEP_BATCH = 40;

export const TACO_CONTRACT = 'swap.taco';
export const DEFIBOX_CONTRACT = 'swap.box';
export const DEFIBOX_LP_CONTRACT = 'lptoken.box';

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function withFailover<T>(endpoints: string[], fn: (base: string) => Promise<T>): Promise<T> {
  let lastError: unknown = new Error('No endpoints configured');
  for (const base of endpoints) {
    try {
      return await fn(base);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

interface TableRowsResponse<T> {
  rows?: T[];
  more?: boolean | string;
  next_key?: string;
}

async function chainPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return withFailover(CHAIN_ENDPOINTS, (base) =>
    fetchJson<T>(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

/** Read a whole contract table, following `next_key` until exhausted. */
async function readTable<T>(
  code: string,
  scope: string,
  table: string,
  pageSize = 1000,
  maxPages = 40,
): Promise<T[]> {
  const out: T[] = [];
  let lower = '';
  for (let page = 0; page < maxPages; page++) {
    const data = await chainPost<TableRowsResponse<T>>('/v1/chain/get_table_rows', {
      json: true,
      code,
      scope,
      table,
      limit: pageSize,
      ...(lower ? { lower_bound: lower } : {}),
    });
    const rows = data.rows ?? [];
    out.push(...rows);
    if (!data.more || !data.next_key) break;
    lower = data.next_key;
  }
  return out;
}

/* --------------------------------------------------------------- USD prices */

interface AlcorToken {
  id?: string;
  symbol?: string;
  contract?: string;
  system_price?: number | string;
}

/** USD price per whole token, keyed `SYMBOL-contract`. */
export type UsdPrices = Map<string, number>;

export function priceKey(symbol: string, contract: string): string {
  return `${symbol.toUpperCase()}-${contract}`;
}

/**
 * USD price of every token Alcor knows, derived from its WAX `system_price`
 * bridged through WAXUSDC — the same bridge the rest of CheeseHub uses.
 */
export async function fetchUsdPrices(): Promise<UsdPrices> {
  const tokens = await fetchJson<AlcorToken[]>(`${ALCOR_API}/tokens`);
  const prices: UsdPrices = new Map();
  const waxPerUsdc = Number(
    tokens.find((t) => t.symbol === 'WAXUSDC' && t.contract === 'eth.token')?.system_price ?? 0,
  );
  if (!(waxPerUsdc > 0)) return prices;
  for (const token of tokens) {
    const symbol = (token.symbol ?? '').toUpperCase();
    const contract = token.contract ?? '';
    const waxPer = Number(token.system_price ?? 0);
    if (!symbol || !contract || !(waxPer > 0)) continue;
    prices.set(priceKey(symbol, contract), waxPer / waxPerUsdc);
  }
  return prices;
}

export function cheeseUsdFrom(prices: UsdPrices): number | undefined {
  const value = prices.get(priceKey(CHEESE_SYMBOL, CHEESE_CONTRACT));
  return value && value > 0 ? value : undefined;
}

/* ------------------------------------------------------------ share holders */

export interface ShareHolder {
  account: string;
  shares: number;
}

/**
 * Holders of one share token. Light API's `topholders` is the cheap path; a
 * direct sweep of the token contract's `accounts` scopes is the fallback.
 */
export async function fetchShareHolders(code: string, symbol: string): Promise<ShareHolder[]> {
  try {
    return await withFailover(LIGHT_API_ENDPOINTS, async (base) => {
      const url =
        `${base}/api/topholders/wax/${encodeURIComponent(code)}/` +
        `${encodeURIComponent(symbol)}/${LIGHT_API_MAX}`;
      const data = await fetchJson<unknown>(url, undefined, HOLDERS_TIMEOUT_MS);
      if (!Array.isArray(data)) throw new Error(`Unexpected holders for ${symbol}@${code}`);
      const out: ShareHolder[] = [];
      for (const row of data as unknown[]) {
        if (!Array.isArray(row)) continue;
        const account = typeof row[0] === 'string' ? row[0] : '';
        const shares = parseFloat(String(row[1] ?? '0'));
        if (account && Number.isFinite(shares) && shares > 0) out.push({ account, shares });
      }
      if (out.length === 0) throw new Error(`No holders of ${symbol}@${code}`);
      return out;
    });
  } catch {
    return sweepShareHolders(code, symbol);
  }
}

async function sweepShareHolders(code: string, symbol: string): Promise<ShareHolder[]> {
  const scopes: string[] = [];
  let lower = '';
  while (scopes.length < MAX_SWEEP_SCOPES) {
    const data = await chainPost<TableRowsResponse<{ scope?: string }>>(
      '/v1/chain/get_table_by_scope',
      { code, table: 'accounts', limit: 1000, ...(lower ? { lower_bound: lower } : {}) },
    );
    const rows = data.rows ?? [];
    for (const row of rows) if (row.scope) scopes.push(row.scope);
    if (!data.more || typeof data.more !== 'string') break;
    lower = data.more;
  }

  const holders: ShareHolder[] = [];
  for (let i = 0; i < scopes.length; i += SWEEP_BATCH) {
    const batch = scopes.slice(i, i + SWEEP_BATCH);
    const results = await Promise.all(
      batch.map(async (scope) => {
        try {
          const rows = await chainPost<TableRowsResponse<{ balance?: string }>>(
            '/v1/chain/get_table_rows',
            { json: true, code, scope, table: 'accounts', limit: 100 },
          );
          for (const row of rows.rows ?? []) {
            if (assetSymbol(row.balance) !== symbol.toUpperCase()) continue;
            const shares = assetAmount(row.balance);
            if (shares > 0) return { account: scope, shares };
          }
        } catch {
          // A single flaky scope read must not abort the sweep.
        }
        return null;
      }),
    );
    for (const row of results) if (row) holders.push(row);
  }
  return holders;
}

/* ---------------------------------------------------------- pair discovery */

/** A constant-product CHEESE pool before its providers are read. */
export interface AmmPoolCandidate {
  venue: LpVenue;
  pair: TrackedPair;
  /** Share-token symbol (also the stored pool id). */
  shareSymbol: string;
  /** Contract issuing the share token. */
  shareContract: string;
  totalShares: number;
  reserveCheese: number;
  reservePaired: number;
  usd: number;
}

interface TacoPairRow {
  id?: string;
  supply?: string;
  pool1?: { quantity?: string; contract?: string };
  pool2?: { quantity?: string; contract?: string };
}

interface DefiboxPairRow {
  id?: number;
  token0?: { contract?: string; symbol?: string };
  token1?: { contract?: string; symbol?: string };
  reserve0?: string;
  reserve1?: string;
  liquidity_token?: number | string;
}

/** Defibox names a pair's LP token `BOX` + the bijective base-26 of its id. */
export function defiboxLpSymbol(pairId: number): string {
  let n = Math.floor(pairId);
  let suffix = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    suffix = String.fromCharCode(65 + rem) + suffix;
    n = Math.floor((n - 1) / 26);
  }
  return `BOX${suffix}`;
}

function symbolCodeOf(raw: unknown): string {
  // Defibox writes symbols as "4,CHEESE".
  const text = String(raw ?? '');
  const parts = text.split(',');
  return (parts[parts.length - 1] ?? '').trim().toUpperCase();
}

/** Every CHEESE pool on Taco, with reserves and a USD estimate. */
export async function fetchTacoCandidates(prices: UsdPrices): Promise<AmmPoolCandidate[]> {
  const rows = await readTable<TacoPairRow>(TACO_CONTRACT, TACO_CONTRACT, 'pairs');
  const out: AmmPoolCandidate[] = [];
  for (const row of rows) {
    const shareSymbol = (row.id ?? '').toUpperCase();
    if (!shareSymbol) continue;
    const legs = [row.pool1, row.pool2];
    const symbols = legs.map((leg) => assetSymbol(leg?.quantity));
    const cheeseIndex = symbols.indexOf(CHEESE_SYMBOL);
    if (cheeseIndex === -1) continue;
    const cheeseLeg = legs[cheeseIndex];
    if ((cheeseLeg?.contract ?? '') !== CHEESE_CONTRACT) continue;
    const otherLeg = legs[cheeseIndex === 0 ? 1 : 0];
    const pairedSymbol = assetSymbol(otherLeg?.quantity);
    const pairedContract = otherLeg?.contract ?? '';
    if (!pairedSymbol || !pairedContract) continue;

    const reserveCheese = assetAmount(cheeseLeg?.quantity);
    const reservePaired = assetAmount(otherLeg?.quantity);
    const totalShares = assetAmount(row.supply);
    if (!(reserveCheese > 0) || !(reservePaired > 0) || !(totalShares > 0)) continue;

    const pair = pairFor(pairedSymbol, pairedContract);
    out.push({
      venue: 'taco',
      pair,
      shareSymbol,
      shareContract: TACO_CONTRACT,
      totalShares,
      reserveCheese,
      reservePaired,
      usd: positionUsdValue(
        reserveCheese,
        reservePaired,
        cheeseUsdFrom(prices),
        prices.get(priceKey(pairedSymbol, pairedContract)),
      ),
    });
  }
  return out;
}

/** Every CHEESE pool on Defibox, with reserves and a USD estimate. */
export async function fetchDefiboxCandidates(prices: UsdPrices): Promise<AmmPoolCandidate[]> {
  const rows = await readTable<DefiboxPairRow>(DEFIBOX_CONTRACT, DEFIBOX_CONTRACT, 'pairs');
  const out: AmmPoolCandidate[] = [];
  for (const row of rows) {
    const id = Number(row.id ?? 0);
    if (!(id > 0)) continue;
    const legs = [
      { token: row.token0, reserve: row.reserve0 },
      { token: row.token1, reserve: row.reserve1 },
    ];
    const cheeseIndex = legs.findIndex(
      (leg) =>
        symbolCodeOf(leg.token?.symbol) === CHEESE_SYMBOL &&
        (leg.token?.contract ?? '') === CHEESE_CONTRACT,
    );
    if (cheeseIndex === -1) continue;
    const cheeseLeg = legs[cheeseIndex];
    const otherLeg = legs[cheeseIndex === 0 ? 1 : 0];
    const pairedSymbol = symbolCodeOf(otherLeg.token?.symbol);
    const pairedContract = otherLeg.token?.contract ?? '';
    if (!pairedSymbol || !pairedContract) continue;

    const reserveCheese = assetAmount(cheeseLeg.reserve);
    const reservePaired = assetAmount(otherLeg.reserve);
    const totalShares = Number(row.liquidity_token ?? 0);
    if (!(reserveCheese > 0) || !(reservePaired > 0) || !(totalShares > 0)) continue;

    const pair = pairFor(pairedSymbol, pairedContract);
    out.push({
      venue: 'defibox',
      pair,
      shareSymbol: defiboxLpSymbol(id),
      shareContract: DEFIBOX_LP_CONTRACT,
      totalShares,
      reserveCheese,
      reservePaired,
      usd: positionUsdValue(
        reserveCheese,
        reservePaired,
        cheeseUsdFrom(prices),
        prices.get(priceKey(pairedSymbol, pairedContract)),
      ),
    });
  }
  return out;
}

/** Group candidates by pair and keep tracked pairs plus anything over $100. */
export function selectAmmPairs(candidates: AmmPoolCandidate[]): {
  pair: TrackedPair;
  tvlUsd: number;
  pools: AmmPoolCandidate[];
}[] {
  const byPair = new Map<string, { pair: TrackedPair; tvlUsd: number; pools: AmmPoolCandidate[] }>();
  for (const candidate of candidates) {
    const entry = byPair.get(candidate.pair.key) ?? {
      pair: candidate.pair,
      tvlUsd: 0,
      pools: [],
    };
    entry.tvlUsd += candidate.usd;
    entry.pools.push(candidate);
    byPair.set(candidate.pair.key, entry);
  }
  return selectVenuePairs(
    [...byPair.values()],
    MIN_TRACKED_POOL_USD,
    MAX_EXTRA_PAIRS_PER_VENUE,
  );
}

/**
 * Full snapshot of one constant-product venue: discover its CHEESE pairs, read
 * every share holder, and split the reserves pro-rata.
 *
 * `onProgress` lets the sampler log as it goes; `pause` lets it throttle.
 */
export async function snapshotAmmVenue(
  venue: 'taco' | 'defibox',
  prices: UsdPrices,
  options: { pause?: () => Promise<void>; log?: (message: string) => void } = {},
): Promise<LpPoolSnapshot[]> {
  const candidates =
    venue === 'taco'
      ? await fetchTacoCandidates(prices)
      : await fetchDefiboxCandidates(prices);
  const selected = selectAmmPairs(candidates);
  const cheeseUsd = cheeseUsdFrom(prices);
  const snapshots: LpPoolSnapshot[] = [];

  for (const entry of selected) {
    const pairedUsd = prices.get(priceKey(entry.pair.symbol, entry.pair.contract));
    const inputs: AmmPoolInput[] = [];
    for (const pool of entry.pools.sort((a, b) => b.reserveCheese - a.reserveCheese)) {
      const holders = await fetchShareHolders(pool.shareContract, pool.shareSymbol);
      inputs.push({
        id: pool.shareSymbol,
        reserveCheese: pool.reserveCheese,
        reservePaired: pool.reservePaired,
        totalShares: pool.totalShares,
        holders,
      });
      if (options.pause) await options.pause();
    }
    const snapshot = buildAmmPoolSnapshot(venuePair(venue, entry.pair), inputs, {
      cheeseUsd,
      pairedUsd,
    });
    if (snapshot.accounts === 0) continue;
    options.log?.(
      `${venue} ${snapshot.label}: $${snapshot.usd.toFixed(2)} • ` +
        `${snapshot.cheese.toFixed(4)} CHEESE • ${snapshot.accounts} accounts`,
    );
    snapshots.push(snapshot);
  }

  return snapshots;
}
