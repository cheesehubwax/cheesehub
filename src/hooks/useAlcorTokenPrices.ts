import { useMemo } from 'react';
import { useSwapTokens } from './useSwapTokens';

// Map of contract:symbol -> price in WAX
export type TokenPriceMap = Map<string, number>;

/**
 * Derives token price data from the shared swap-tokens query
 * instead of making a separate fetch to the same Alcor /tokens endpoint.
 */
export function useAlcorTokenPrices() {
  const { tokens, isLoading, error } = useSwapTokens();

  const data = useMemo(() => {
    if (!tokens.length) return undefined;
    const priceMap = new Map<string, number>();
    tokens.forEach(token => {
      if (token.system_price && token.system_price > 0) {
        priceMap.set(`${token.contract}:${token.ticker}`, token.system_price);
      }
    });
    return priceMap;
  }, [tokens]);

  return { data, isLoading, error };
}
