import { useState, useEffect, useCallback } from 'react';

const ALCOR_API = 'https://wax.alcor.exchange/api';

export interface AlcorPool {
  id: number;
  tokenA: { contract: string; symbol: string; quantity: string };
  tokenB: { contract: string; symbol: string; quantity: string };
}

export interface TokenPrice {
  symbol: string;
  contract: string;
  priceInWax: number;
  priceInUsd: number;
}

export function useAlcorTokenPrices(waxUsdPrice: number = 0) {
  const [pools, setPools] = useState<AlcorPool[]>([]);
  const [prices, setPrices] = useState<Map<string, TokenPrice>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPools = useCallback(async () => {
    try {
      const response = await fetch(`${ALCOR_API}/v2/swapPools`);
      if (!response.ok) throw new Error('Failed to fetch Alcor pools');
      const data: AlcorPool[] = await response.json();
      setPools(data);

      // Calculate prices from pools
      const priceMap = new Map<string, TokenPrice>();

      // WAX is the base currency
      priceMap.set('WAX', {
        symbol: 'WAX',
        contract: 'eosio.token',
        priceInWax: 1,
        priceInUsd: waxUsdPrice,
      });

      // Find token prices relative to WAX
      data.forEach(pool => {
        const isTokenAWax = pool.tokenA.symbol === 'WAX' && pool.tokenA.contract === 'eosio.token';
        const isTokenBWax = pool.tokenB.symbol === 'WAX' && pool.tokenB.contract === 'eosio.token';

        if (isTokenAWax || isTokenBWax) {
          const waxToken = isTokenAWax ? pool.tokenA : pool.tokenB;
          const otherToken = isTokenAWax ? pool.tokenB : pool.tokenA;

          const waxAmount = parseFloat(waxToken.quantity);
          const otherAmount = parseFloat(otherToken.quantity);

          if (otherAmount > 0) {
            const priceInWax = waxAmount / otherAmount;
            priceMap.set(`${otherToken.symbol}@${otherToken.contract}`, {
              symbol: otherToken.symbol,
              contract: otherToken.contract,
              priceInWax,
              priceInUsd: priceInWax * waxUsdPrice,
            });
          }
        }
      });

      setPrices(priceMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [waxUsdPrice]);

  useEffect(() => {
    fetchPools();
    const interval = setInterval(fetchPools, 30000);
    return () => clearInterval(interval);
  }, [fetchPools]);

  const getTokenPrice = useCallback((symbol: string, contract?: string): TokenPrice | null => {
    if (contract) {
      return prices.get(`${symbol}@${contract}`) || null;
    }
    // Search by symbol only
    for (const [key, value] of prices.entries()) {
      if (value.symbol === symbol) return value;
    }
    return null;
  }, [prices]);

  return { pools, prices, getTokenPrice, loading, error, refetch: fetchPools };
}
