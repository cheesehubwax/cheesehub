import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSwapTokens } from './useSwapTokens';

// Map of contract:symbol -> price in WAX
export type TokenPriceMap = Map<string, number>;

/**
 * Derives token price data from the shared swap-tokens query
 * instead of making a separate fetch to the same Alcor /tokens endpoint.
 */
export function useAlcorTokenPrices(livePrices = false) {
  const { tokens, isLoading, error, isFetching, dataUpdatedAt, isPlaceholderData } = useSwapTokens(livePrices);
  const queryClient = useQueryClient();

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

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['swap-tokens'] });

  // Metadata-only fallback and cached placeholders are not fresh prices.
  const hasLivePrices = tokens.some((t) => `${t.contract}:${t.ticker}` !== 'eosio.token:WAX' && t.system_price > 0);
  const pricesUpdatedAt = !isPlaceholderData && hasLivePrices ? dataUpdatedAt : 0;
  return { data, isLoading, error, refetch, isFetching, pricesUpdatedAt };
}
