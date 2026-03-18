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
    return {
      waxPrice: cheese.system_price ?? 0,
      usdPrice: cheese.usd_price ?? 0,
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
