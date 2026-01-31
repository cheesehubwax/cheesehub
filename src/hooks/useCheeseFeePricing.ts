import { useState, useEffect, useMemo } from 'react';
import {
  CHEESE_FEE_ENABLED,
  WAX_EQUIVALENT_FEE,
  CHEESE_DISCOUNT,
  calculateDiscountedCheeseAmount,
  formatCheeseAmount,
  formatCheeseDisplay,
  fetchContractWaxdaoBalance,
} from '@/lib/cheeseFees';

export interface CheeseFeePricing {
  enabled: boolean;
  cheeseAmount: number;
  cheeseAmountFormatted: string;
  cheeseAmountDisplay: string;
  waxEquivalent: number;
  discountPercent: number;
  poolHasBalance: boolean;
  poolBalance: number;
}

export function useCheeseFeePricing(cheeseWaxPrice: number = 0) {
  const [poolBalance, setPoolBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!CHEESE_FEE_ENABLED) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function checkPool() {
      try {
        const balance = await fetchContractWaxdaoBalance();
        if (mounted) setPoolBalance(balance);
      } catch (err) {
        console.error('Failed to check pool balance:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkPool();
    const interval = setInterval(checkPool, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const pricing = useMemo((): CheeseFeePricing => {
    if (!CHEESE_FEE_ENABLED || cheeseWaxPrice <= 0) {
      return {
        enabled: false,
        cheeseAmount: 0,
        cheeseAmountFormatted: '0.0000 CHEESE',
        cheeseAmountDisplay: '0',
        waxEquivalent: WAX_EQUIVALENT_FEE,
        discountPercent: CHEESE_DISCOUNT * 100,
        poolHasBalance: false,
        poolBalance: 0,
      };
    }

    const cheeseAmount = calculateDiscountedCheeseAmount(WAX_EQUIVALENT_FEE, cheeseWaxPrice);

    return {
      enabled: true,
      cheeseAmount,
      cheeseAmountFormatted: formatCheeseAmount(cheeseAmount),
      cheeseAmountDisplay: formatCheeseDisplay(cheeseAmount),
      waxEquivalent: WAX_EQUIVALENT_FEE,
      discountPercent: CHEESE_DISCOUNT * 100,
      poolHasBalance: poolBalance >= 250, // Need at least 250 WAXDAO
      poolBalance,
    };
  }, [cheeseWaxPrice, poolBalance]);

  return { pricing, loading };
}
