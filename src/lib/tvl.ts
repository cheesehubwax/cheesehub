import { fetchTableRows } from './waxRpcFallback';
import { chainPost } from './chainRequest';

const CHEESE_CONTRACT = 'cheeseburger';
const CHEESE_SYMBOL = 'CHEESE';

interface AlcorPool {
  id: number;
  tokenA: { contract: string; symbol: string; quantity: string };
  tokenB: { contract: string; symbol: string; quantity: string };
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
  alcorSwap: number;
  alcorSpot: number;
  defibox: number;
  taco: number;
  nefty: number;
  totalUSD: number;
  totalWAX: number;
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
function isCheesePool(pool: AlcorPool): boolean {
  return (
    (pool.tokenA.contract === CHEESE_CONTRACT && pool.tokenA.symbol.includes(CHEESE_SYMBOL)) ||
    (pool.tokenB.contract === CHEESE_CONTRACT && pool.tokenB.symbol.includes(CHEESE_SYMBOL))
  );
}

export async function fetchAlcorSwapCheeseTVL(): Promise<number> {
  try {
    // Alcor filters server-side by either side of the pair: ~60 KB in two
    // requests instead of the ~11 MB full pool list. Both must answer, so a
    // half-read never shows up as a lower TVL.
    const [asA, asB] = await Promise.all([
      fetchWithTimeout<AlcorPool[]>(`${ALCOR_API}/swap/pools?tokenA=cheese-cheeseburger`),
      fetchWithTimeout<AlcorPool[]>(`${ALCOR_API}/swap/pools?tokenB=cheese-cheeseburger`),
    ]);
    const byId = new Map<number, AlcorPool>();
    for (const pool of [...asA, ...asB]) if (isCheesePool(pool)) byId.set(pool.id, pool);
    let total = 0;
    for (const pool of byId.values()) total += pool.tvlUSD || 0;
    return total;
  } catch (error) {
    console.warn('Failed to fetch Alcor Swap CHEESE TVL:', error);
    return 0;
  }
}

export async function fetchAlcorSpotCheeseTVL(waxUsdPrice: number): Promise<number> {
  try {
    // Only the CHEESE/WAX spot market is counted, so read just that one.
    const market = await fetchWithTimeout<AlcorTicker>(
      `${ALCOR_API}/tickers/cheese-cheeseburger_wax-eosio.token`,
    );
    return (market?.target_volume || 0) * waxUsdPrice;
  } catch (error) {
    console.warn('Failed to fetch Alcor Spot CHEESE TVL:', error);
    return 0;
  }
}

export async function fetchDefiboxCheeseTVL(waxUsdPrice: number): Promise<number> {
  try {
    const response = await fetchTableRows<DefiboxPair>({
      code: 'swap.box',
      scope: 'swap.box',
      table: 'pairs',
      limit: 500,
    });

    // Filter for CHEESE pairs
    const cheesePairs = response.rows.filter(pair =>
      pair.token0.contract === CHEESE_CONTRACT || pair.token1.contract === CHEESE_CONTRACT
    );

    let totalTVL = 0;

    for (const pair of cheesePairs) {
      const reserve0 = parseQuantity(pair.reserve0);
      const reserve1 = parseQuantity(pair.reserve1);

      // Calculate TVL - both sides of the pair
      // If one side is WAX, use WAX price to get USD value
      if (pair.token0.contract === 'eosio.token' && pair.token0.symbol === '8,WAX') {
        totalTVL += reserve0.amount * waxUsdPrice * 2; // Multiply by 2 for both sides
      } else if (pair.token1.contract === 'eosio.token' && pair.token1.symbol === '8,WAX') {
        totalTVL += reserve1.amount * waxUsdPrice * 2;
      }
    }

    return totalTVL;
  } catch (error) {
    console.warn('Failed to fetch Defibox CHEESE TVL:', error);
    return 0;
  }
}

export async function fetchTacoCheeseTVL(waxUsdPrice: number): Promise<number> {
  try {
    const response = await fetchTableRows<TacoPair>({
      code: 'swap.taco',
      scope: 'swap.taco',
      table: 'pairs',
      limit: 500,
    });

    // Filter for CHEESE pairs
    const cheesePairs = response.rows.filter(pair =>
      pair.pool1.contract === CHEESE_CONTRACT || pair.pool2.contract === CHEESE_CONTRACT
    );

    let totalTVL = 0;

    for (const pair of cheesePairs) {
      const pool1 = parseQuantity(pair.pool1.quantity);
      const pool2 = parseQuantity(pair.pool2.quantity);

      // If one side is WAX, use WAX price to get USD value
      if (pair.pool1.contract === 'eosio.token' && pool1.symbol === 'WAX') {
        totalTVL += pool1.amount * waxUsdPrice * 2;
      } else if (pair.pool2.contract === 'eosio.token' && pool2.symbol === 'WAX') {
        totalTVL += pool2.amount * waxUsdPrice * 2;
      }
    }

    return totalTVL;
  } catch (error) {
    console.warn('Failed to fetch Taco CHEESE TVL:', error);
    return 0;
  }
}

export async function fetchNeftyCheeseTVL(cheeseUsdPrice: number): Promise<number> {
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
    return 0;
  }
}

export async function fetchCheeseTotalTVL(waxUsdPrice: number, cheeseUsdPrice: number): Promise<TVLData> {
  const [alcorSwap, alcorSpot, defibox, taco, nefty] = await Promise.all([
    fetchAlcorSwapCheeseTVL(),
    fetchAlcorSpotCheeseTVL(waxUsdPrice),
    fetchDefiboxCheeseTVL(waxUsdPrice),
    fetchTacoCheeseTVL(waxUsdPrice),
    fetchNeftyCheeseTVL(cheeseUsdPrice),
  ]);

  const totalUSD = alcorSwap + alcorSpot + defibox + taco + nefty;
  const totalWAX = waxUsdPrice > 0 ? totalUSD / waxUsdPrice : 0;

  return {
    alcorSwap,
    alcorSpot,
    defibox,
    taco,
    nefty,
    totalUSD,
    totalWAX,
  };
}
