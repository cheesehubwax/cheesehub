import { useMemo } from "react";
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

export interface CheeseFeePricing {
  cheeseAmount: number;
  formattedForTx: string;
  displayAmount: string;
  savingsDisplay: string;
  cheeseWaxPrice: number;
  waxEquivalent: number;
  isLoading: boolean;
  isAvailable: boolean;
  refetch: () => void;
}

export function useCheeseFeePricing(waxFee: number = WAX_FEE_AMOUNT): CheeseFeePricing {
  const { data: prices, isLoading, refetch } = useAlcorTokenPrices();

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
      refetch,
    };
  }, [prices, waxFee, isLoading, refetch]);

  return pricing;
}
