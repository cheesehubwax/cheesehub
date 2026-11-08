import { chainPost } from './chainRequest';
import { buildReservePrices, isCheeseLeg, valueReserves, type ReserveLeg, type TvlToken } from './tvlPricing';

const CHEESE_CONTRACT = 'cheeseburger';
const CHEESE_SYMBOL = 'CHEESE';

interface AlcorPool {
  id: number;
  active?: boolean | number;
  tokenA: { contract: string; symbol: string; quantity: string | number };
  tokenB: { contract: string; symbol: string; quantity: string | number };
  tvlUSD: number;
}

interface AlcorTicker {
  ticker_id: string;
  base_currency: string;
  target_currency: string;
  bid: number;
  ask: number;
  base_volume: number;
  target_volume: number;
}

interface DefiboxPair {
  id: number;
  token0: { contract: string; symbol: string };
  token1: { contract: string; symbol: string };
  reserve0: string;
  reserve1: string;
  liquidity_token: number;
  price0_last: string;
  price1_last: string;
}

interface TacoPair {
  id: number;
  pool1: { contract: string; quantity: string };
  pool2: { contract: string; quantity: string };
}

export interface TVLData {
  alcorSwap: number | null;
  alcorSpot: number | null;
  defibox: number | null;
  taco: number | null;
  nefty: number | null;
  totalUSD: number;
  totalWAX: number;
  partial: boolean;
}

function parseQuantity(quantity: string): { amount: number; symbol: string } {
  const parts = quantity.split(' ');
  return {
    amount: parseFloat(parts[0]) || 0,
    symbol: parts[1] || '',
  };
}

const ALCOR_API = 'https://wax.alcor.exchange/api/v2';
const SOURCE_TIMEOUT_MS = 8_000;

/** fetch with a hard time limit so one slow source can't hold up the rest. */
async function fetchWithTimeout<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`${url} failed (${res.status})`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

type VenueValue = { usd: number; complete: boolean };

function sumPools(pools: ReserveLeg[][], prices: ReadonlyMap<string, number>): VenueValue {
  let usd = 0;
  let complete = true;
  for (const legs of pools) {
    if (!legs.some(isCheeseLeg)) continue;
    const value = valueReserves(legs, prices);
    usd += value.usd;
    complete &&= value.complete;
  }
  return { usd, complete };
}

/** A bounded, complete table read. Never call a truncated page a whole venue. */
async function readPairs<T>(code: string): Promise<T[]> {
  const rows: T[] = [];
  let lower = '';
  for (let page = 0; page < 40; page++) {
    const data = await chainPost<{ rows: T[]; more?: boolean | string; next_key?: string }>(
      '/v1/chain/get_table_rows',
      { code, scope: code, table: 'pairs', json: true, limit: 1000, ...(lower ? { lower_bound: lower } : {}) },
      { timeoutMs: SOURCE_TIMEOUT_MS },
    );
    rows.push(...data.rows);
    if (!data.more) return rows;
    const next = data.next_key || (typeof data.more === 'string' ? data.more : '');
    if (!next || next === lower) throw new Error(`${code} pairs cursor stalled`);
    lower = next;
  }
  throw new Error(`${code} pairs exceeded read limit`);
}

export async function fetchAlcorSwapCheeseTVL(prices: ReadonlyMap<string, number>): Promise<VenueValue> {
    // Alcor filters server-side by either side of the pair: ~60 KB in two
    // requests instead of the ~11 MB full pool list. Both must answer, so a
    // half-read never shows up as a lower TVL.
    const [asA, asB] = await Promise.all([
      fetchWithTimeout<AlcorPool[]>(`${ALCOR_API}/swap/pools?tokenA=cheese-cheeseburger`),
      fetchWithTimeout<AlcorPool[]>(`${ALCOR_API}/swap/pools?tokenB=cheese-cheeseburger`),
    ]);
    const byId = new Map<number, AlcorPool>();
    for (const pool of [...asA, ...asB]) {
      if (pool.active !== false && pool.active !== 0) byId.set(pool.id, pool);
    }
    return sumPools([...byId.values()].map(pool => [pool.tokenA, pool.tokenB].map(token => ({
      symbol: token.symbol, contract: token.contract, quantity: Number(token.quantity),
    }))), prices);
}

export async function fetchAlcorSpotCheeseTVL(waxUsdPrice: number): Promise<number | null> {
  try {
    // Only the CHEESE/WAX spot market is counted, so read just that one.
    const market = await fetchWithTimeout<AlcorTicker>(
      `${ALCOR_API}/tickers/cheese-cheeseburger_wax-eosio.token`,
    );
    return (market?.target_volume || 0) * waxUsdPrice;
  } catch (error) {
    console.warn('Failed to fetch Alcor Spot CHEESE TVL:', error);
    return null;
  }
}

export async function fetchDefiboxCheeseTVL(prices: ReadonlyMap<string, number>): Promise<VenueValue> {
  const pairs = await readPairs<DefiboxPair>('swap.box');
  return sumPools(pairs.map(pair => [
    { ...pair.token0, quantity: parseQuantity(pair.reserve0).amount },
    { ...pair.token1, quantity: parseQuantity(pair.reserve1).amount },
  ]), prices);
}

export async function fetchTacoCheeseTVL(prices: ReadonlyMap<string, number>): Promise<VenueValue> {
  const pairs = await readPairs<TacoPair>('swap.taco');
  return sumPools(pairs.map(pair => [pair.pool1, pair.pool2].map(leg => ({
    ...parseQuantity(leg.quantity), contract: leg.contract, quantity: parseQuantity(leg.quantity).amount,
  }))), prices);
}

export async function fetchNeftyCheeseTVL(cheeseUsdPrice: number): Promise<number | null> {
  try {
    // CHEESE balance held by swap.nefty, via the shared backup-node reader.
    const balances = await chainPost<string[]>('/v1/chain/get_currency_balance', {
      code: CHEESE_CONTRACT,
      account: 'swap.nefty',
      symbol: CHEESE_SYMBOL,
    });
    if (!balances || balances.length === 0) return 0;

    const { amount } = parseQuantity(balances[0]);
    // TVL = CHEESE amount × price × 2 (for the paired asset)
    return amount * cheeseUsdPrice * 2;
  } catch (error) {
    console.warn('Failed to fetch Nefty CHEESE TVL:', error);
    return null;
  }
}

export async function fetchCheeseTotalTVL(waxUsdPrice: number, cheeseUsdPrice: number): Promise<TVLData> {
  const prices = buildReservePrices(await fetchWithTimeout<TvlToken[]>(`${ALCOR_API}/tokens`));
  if (!(prices.get('WAX-eosio.token') && prices.get('CHEESE-cheeseburger'))) {
    throw new Error('Live liquidity prices unavailable');
  }
  const readVenue = async (read: () => Promise<VenueValue>): Promise<VenueValue | null> => {
    try { return await read(); }
    catch (error) { console.warn('Liquidity venue unavailable:', error); return null; }
  };
  const [alcorSwap, alcorSpot, defibox, taco, nefty] = await Promise.all([
    readVenue(() => fetchAlcorSwapCheeseTVL(prices)),
    fetchAlcorSpotCheeseTVL(waxUsdPrice),
    readVenue(() => fetchDefiboxCheeseTVL(prices)),
    readVenue(() => fetchTacoCheeseTVL(prices)),
    fetchNeftyCheeseTVL(cheeseUsdPrice),
  ]);

  const totalUSD = (alcorSwap?.usd ?? 0) + (alcorSpot ?? 0) + (defibox?.usd ?? 0) + (taco?.usd ?? 0) + (nefty ?? 0);
  const totalWAX = waxUsdPrice > 0 ? totalUSD / waxUsdPrice : 0;

  return {
    alcorSwap: alcorSwap?.usd ?? null,
    alcorSpot,
    defibox: defibox?.usd ?? null,
    taco: taco?.usd ?? null,
    nefty,
    totalUSD,
    totalWAX,
    partial: !alcorSwap?.complete || !defibox?.complete || !taco?.complete || alcorSpot === null || nefty === null,
  };
}
