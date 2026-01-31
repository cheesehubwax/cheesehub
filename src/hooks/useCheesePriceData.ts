import { useState, useEffect } from 'react';
import { CHEESE_CONFIG } from '@/lib/waxConfig';

const ALCOR_API = 'https://wax.alcor.exchange/api';

export interface CheesePriceData {
  priceInWax: number;
  priceInUsd: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
}

export function useCheesePriceData(waxUsdPrice: number = 0) {
  const [priceData, setPriceData] = useState<CheesePriceData>({
    priceInWax: 0,
    priceInUsd: 0,
    change24h: 0,
    volume24h: 0,
    liquidity: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchCheesePrice() {
      try {
        // Fetch CHEESE/WAX pool data from Alcor
        const response = await fetch(`${ALCOR_API}/v2/swapPools`);
        if (!response.ok) throw new Error('Failed to fetch pool data');

        const pools = await response.json();

        // Find CHEESE/WAX pool
        const cheesePool = pools.find((pool: { tokenA: { symbol: string; contract: string }; tokenB: { symbol: string; contract: string } }) =>
          (pool.tokenA.symbol === CHEESE_CONFIG.tokenSymbol && pool.tokenA.contract === CHEESE_CONFIG.tokenContract) ||
          (pool.tokenB.symbol === CHEESE_CONFIG.tokenSymbol && pool.tokenB.contract === CHEESE_CONFIG.tokenContract)
        );

        if (cheesePool && mounted) {
          const isCheeseTokenA = cheesePool.tokenA.symbol === CHEESE_CONFIG.tokenSymbol;
          const cheeseToken = isCheeseTokenA ? cheesePool.tokenA : cheesePool.tokenB;
          const waxToken = isCheeseTokenA ? cheesePool.tokenB : cheesePool.tokenA;

          const cheeseAmount = parseFloat(cheeseToken.quantity);
          const waxAmount = parseFloat(waxToken.quantity);

          const priceInWax = cheeseAmount > 0 ? waxAmount / cheeseAmount : 0;

          setPriceData({
            priceInWax,
            priceInUsd: priceInWax * waxUsdPrice,
            change24h: 0, // Would need historical data
            volume24h: cheesePool.volume24 || 0,
            liquidity: waxAmount * 2 * waxUsdPrice,
          });
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchCheesePrice();
    const interval = setInterval(fetchCheesePrice, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [waxUsdPrice]);

  return { priceData, loading, error };
}
