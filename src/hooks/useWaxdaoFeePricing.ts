import { useState, useEffect, useMemo } from 'react';
import { fetchTableRows } from '@/lib/waxRpcFallback';

const WAXDAO_TOKEN_CONTRACT = 'token.waxdao';
const WAX_FEE_AMOUNT = 250;

export interface WaxdaoFeePricing {
  waxdaoAmount: number;
  waxdaoAmountFormatted: string;
  waxEquivalent: number;
  waxdaoWaxPrice: number;
}

export function useWaxdaoFeePricing() {
  const [waxdaoWaxPrice, setWaxdaoWaxPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchWaxdaoPrice() {
      try {
        // Fetch WAXDAO price from Alcor
        const response = await fetch('https://wax.alcor.exchange/api/v2/swapPools');
        if (!response.ok) throw new Error('Failed to fetch pool data');

        const pools = await response.json();

        // Find WAXDAO/WAX pool
        const waxdaoPool = pools.find((pool: { tokenA: { symbol: string; contract: string }; tokenB: { symbol: string; contract: string } }) =>
          (pool.tokenA.symbol === 'WAXDAO' && pool.tokenA.contract === WAXDAO_TOKEN_CONTRACT) ||
          (pool.tokenB.symbol === 'WAXDAO' && pool.tokenB.contract === WAXDAO_TOKEN_CONTRACT)
        );

        if (waxdaoPool && mounted) {
          const isWaxdaoTokenA = waxdaoPool.tokenA.symbol === 'WAXDAO';
          const waxdaoToken = isWaxdaoTokenA ? waxdaoPool.tokenA : waxdaoPool.tokenB;
          const waxToken = isWaxdaoTokenA ? waxdaoPool.tokenB : waxdaoPool.tokenA;

          const waxdaoAmount = parseFloat(waxdaoToken.quantity);
          const waxAmount = parseFloat(waxToken.quantity);

          const priceInWax = waxdaoAmount > 0 ? waxAmount / waxdaoAmount : 0;
          setWaxdaoWaxPrice(priceInWax);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchWaxdaoPrice();
    const interval = setInterval(fetchWaxdaoPrice, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const pricing = useMemo((): WaxdaoFeePricing => {
    if (waxdaoWaxPrice <= 0) {
      return {
        waxdaoAmount: 250, // Default fallback
        waxdaoAmountFormatted: '250.00000000 WAXDAO',
        waxEquivalent: WAX_FEE_AMOUNT,
        waxdaoWaxPrice: 0,
      };
    }

    // Calculate how much WAXDAO equals 250 WAX
    const waxdaoAmount = WAX_FEE_AMOUNT / waxdaoWaxPrice;

    return {
      waxdaoAmount,
      waxdaoAmountFormatted: `${waxdaoAmount.toFixed(8)} WAXDAO`,
      waxEquivalent: WAX_FEE_AMOUNT,
      waxdaoWaxPrice,
    };
  }, [waxdaoWaxPrice]);

  return { pricing, loading, error };
}
