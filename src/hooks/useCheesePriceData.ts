import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSwapTokens } from './useSwapTokens';
import { cached, readStatCache } from '@/lib/statCache';

export interface CheesePriceData {
  waxPrice: number;
  usdPrice: number;
}

const ALCOR_API = 'https://wax.alcor.exchange/api/v2';
const CACHE_KEY = 'cheese-price-live';
const TIMEOUT_MS = 8_000;

interface AlcorTokenRow {
  system_price?: number;
  usd_price?: number;
}

async function fetchToken(id: string): Promise<AlcorTokenRow> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ALCOR_API}/tokens/${id}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Alcor token ${id} failed (${res.status})`);
    return (await res.json()) as AlcorTokenRow;
  } finally {
    clearTimeout(timer);
  }
}

/** Same derivation as before: CHEESE→WAX→WAXUSDC bridge, Alcor usd_price as fallback. */
function derive(cheese: AlcorTokenRow | undefined, waxusdc: AlcorTokenRow | undefined): CheesePriceData | undefined {
  if (!cheese) return undefined;
  const cheeseWax = cheese.system_price ?? 0;
  const waxusdcSys = waxusdc?.system_price ?? 0; // WAX per 1 WAXUSDC
  const derivedUsd = cheeseWax > 0 && waxusdcSys > 0 ? cheeseWax / waxusdcSys : 0;
  return { waxPrice: cheeseWax, usdPrice: derivedUsd > 0 ? derivedUsd : cheese.usd_price ?? 0 };
}

/** Main CHEESE/WAX swap pool (0.3% fee, deepest liquidity) — its live price is what a trade gets. */
export const CHEESE_WAX_POOL_ID = 1252;

interface AlcorPoolSide { contract?: string; symbol?: string }
export interface AlcorPoolRow { tokenA?: AlcorPoolSide; tokenB?: AlcorPoolSide; priceA?: number; priceB?: number }

/** WAX per CHEESE from the live pool, verifying which side is CHEESE; undefined if the row doesn't match. */
export function cheeseWaxFromPool(pool: AlcorPoolRow | undefined): number | undefined {
  if (!pool) return undefined;
  const isCheese = (t?: AlcorPoolSide) => t?.symbol === 'CHEESE' && t?.contract === 'cheeseburger';
  const isWax = (t?: AlcorPoolSide) => t?.symbol === 'WAX' && t?.contract === 'eosio.token';
  let price: number | undefined;
  if (isCheese(pool.tokenA) && isWax(pool.tokenB)) price = Number(pool.priceA);
  else if (isWax(pool.tokenA) && isCheese(pool.tokenB)) price = Number(pool.priceB);
  return price !== undefined && Number.isFinite(price) && price > 0 ? price : undefined;
}

async function fetchPool(id: number): Promise<AlcorPoolRow> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ALCOR_API}/swap/pools/${id}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Alcor pool ${id} failed (${res.status})`);
    return (await res.json()) as AlcorPoolRow;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLitePrice(): Promise<CheesePriceData> {
  // Live swap price from the main pool; Alcor's slower token index is only a fallback.
  const [cheese, waxusdc, pool] = await Promise.all([
    fetchToken('cheese-cheeseburger'),
    fetchToken('waxusdc-eth.token').catch(() => undefined),
    fetchPool(CHEESE_WAX_POOL_ID).catch(() => undefined),
  ]);
  const live = cheeseWaxFromPool(pool);
  const data = derive(live ? { ...cheese, system_price: live } : cheese, waxusdc);
  if (!data || data.waxPrice <= 0) throw new Error('CHEESE price unavailable');
  return data;
}

/**
 * CHEESE price from two small Alcor token lookups; falls back to the shared
 * swap-tokens list if those fail.
 */
export function useCheesePriceData() {
  const lite = useQuery<CheesePriceData>({
    queryKey: ['cheese-price-live'],
    queryFn: cached(CACHE_KEY, fetchLitePrice),
    placeholderData: () => readStatCache<CheesePriceData>(CACHE_KEY),
    staleTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const { tokens, isLoading: listLoading, error: listError } = useSwapTokens();

  const listData = useMemo<CheesePriceData | undefined>(() => {
    if (!tokens.length) return undefined;
    const cheese = tokens.find((t) => t.ticker === 'CHEESE' && t.contract === 'cheeseburger');
    const waxusdc = tokens.find((t) => t.ticker === 'WAXUSDC' && t.contract === 'eth.token');
    return derive(cheese, waxusdc);
  }, [tokens]);

  const data = lite.data ?? listData;
  const isLoading = !data && (lite.isLoading || listLoading);
  const error = data ? null : lite.error && listError ? lite.error : null;

  return {
    data,
    isLoading,
    error,
    isError: !!error,
    refetch: lite.refetch,
    isFetching: lite.isFetching,
  };
}
