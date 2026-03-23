import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAlcorTokenPrices } from "./useAlcorTokenPrices";
import {
  CHEESE_TOKEN_CONTRACT,
  CHEESE_TOKEN_SYMBOL,
  CHEESE_DISCOUNT,
  WAX_FEE_AMOUNT,
  calculateDiscountedCheeseAmount,
  formatCheeseAmount,
  formatCheeseDisplay,
} from "@/lib/cheeseFees";
import {
  fetchFeeFeeConfig,
  fetchPoolReserves,
  calcPriceFromReserves,
  calcDeviation,
} from "@/lib/adminData";

const CRITICAL_DEVIATION_PCT = 8;
const CHEESE_WAX_POOL_ID = 1252;

export interface CheeseFeePricing {
  cheeseAmount: number;
  formattedForTx: string;
  displayAmount: string;
  savingsDisplay: string;
  cheeseWaxPrice: number;
  waxEquivalent: number;
  isLoading: boolean;
  isAvailable: boolean;
  isBaselineCritical: boolean;
  refetch: () => void;
}

export function useCheeseFeePricing(waxFee: number = WAX_FEE_AMOUNT): CheeseFeePricing {
  const { data: prices, isLoading: pricesLoading, refetch } = useAlcorTokenPrices();

  const { data: baselineData, isLoading: baselineLoading } = useQuery({
    queryKey: ["cheese-fee-baseline-check"],
    queryFn: async () => {
      const [config, pool] = await Promise.all([
        fetchFeeFeeConfig(),
        fetchPoolReserves(CHEESE_WAX_POOL_ID),
      ]);
      if (!config || !pool) return { critical: false };
      const { priceBinA: liveCheesePerWax } = calcPriceFromReserves(pool);
      const deviation = calcDeviation(liveCheesePerWax, config.wax_per_cheese_baseline);
      return { critical: Math.abs(deviation) >= CRITICAL_DEVIATION_PCT };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const isLoading = pricesLoading || baselineLoading;
  const isBaselineCritical = baselineData?.critical ?? false;

  const pricing = useMemo(() => {
    const priceKey = `${CHEESE_TOKEN_CONTRACT}:${CHEESE_TOKEN_SYMBOL}`;
    const cheeseWaxPrice = prices?.get(priceKey) ?? 0;

    const cheeseAmount = calculateDiscountedCheeseAmount(waxFee, cheeseWaxPrice);
    const formattedForTx = formatCheeseAmount(cheeseAmount);
    const displayAmount = `${formatCheeseDisplay(cheeseAmount)} CHEESE`;

    const savingsPercent = Math.round(CHEESE_DISCOUNT * 100);
    const savingsDisplay = `Save ${savingsPercent}%!`;

    return {
      cheeseAmount,
      formattedForTx,
      displayAmount,
      savingsDisplay,
      cheeseWaxPrice,
      waxEquivalent: waxFee,
      isLoading,
      isAvailable: cheeseWaxPrice > 0,
      isBaselineCritical,
      refetch,
    };
  }, [prices, waxFee, isLoading, isBaselineCritical, refetch]);

  return pricing;
}
