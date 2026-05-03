import { useMemo } from 'react';
import { useSwapTokens } from './useSwapTokens';

export interface CheesePriceData {
  waxPrice: number;
  usdPrice: number;
}

/**
 * Derives CHEESE price from the shared swap-tokens query
 * instead of making a separate API call.
 */
export function useCheesePriceData() {
  const { tokens, isLoading, error, refetch, isFetching } = useSwapTokens();

  const data = useMemo<CheesePriceData | undefined>(() => {
    if (!tokens.length) return undefined;
    const cheese = tokens.find(
      (t) => t.ticker === 'CHEESE' && t.contract === 'cheeseburger'
    );
    if (!cheese) return undefined;
    // Derive USD via the on-chain CHEESE→WAX→WAXUSDC bridge instead of trusting
    // Alcor's `usd_price` (which uses an external WAX/USD feed that drifts).
    const waxusdc = tokens.find(
      (t) => t.ticker === 'WAXUSDC' && t.contract === 'eth.token'
    );
    const cheeseWax = cheese.system_price ?? 0;
    const waxusdcSys = waxusdc?.system_price ?? 0; // WAX per 1 WAXUSDC
    const derivedUsd =
      cheeseWax > 0 && waxusdcSys > 0 ? cheeseWax / waxusdcSys : 0;
    return {
      waxPrice: cheeseWax,
      usdPrice: derivedUsd > 0 ? derivedUsd : cheese.usd_price ?? 0,
    };
  }, [tokens]);

  return {
    data,
    isLoading,
    error,
    isError: !!error,
    refetch,
    isFetching,
  };
}
