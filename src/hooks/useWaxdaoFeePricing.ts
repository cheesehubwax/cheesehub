import { useMemo } from "react";
import { useAlcorTokenPrices } from "./useAlcorTokenPrices";

const WAXDAO_CONTRACT = "token.waxdao";
const WAXDAO_SYMBOL = "WAXDAO";
const WAXDAO_PRECISION = 8;

const WAX_FEE = 265;
const WAXDAO_DISCOUNT = 0.20;
const SAFETY_BUFFER = 0.005;

export interface WaxdaoFeePricing {
  waxdaoAmount: number;
  formattedForTx: string;
  displayAmount: string;
  waxdaoWaxPrice: number;
  isLoading: boolean;
  isAvailable: boolean;
  refetch: () => void;
}

export function useWaxdaoFeePricing(): WaxdaoFeePricing {
  const { data: prices, isLoading, refetch } = useAlcorTokenPrices();

  return useMemo(() => {
    const priceKey = `${WAXDAO_CONTRACT}:${WAXDAO_SYMBOL}`;
    const waxdaoWaxPrice = prices?.get(priceKey) ?? 0;

    if (waxdaoWaxPrice <= 0) {
      return {
        waxdaoAmount: 0,
        formattedForTx: "",
        displayAmount: "",
        waxdaoWaxPrice: 0,
        isLoading,
        isAvailable: false,
        refetch,
      };
    }

    // WaxDAO formula: (265 WAX / price) * 0.80
    const baseAmount = WAX_FEE / waxdaoWaxPrice;
    const discountedAmount = baseAmount * (1 - WAXDAO_DISCOUNT);
    const finalAmount = discountedAmount * (1 + SAFETY_BUFFER);

    return {
      waxdaoAmount: finalAmount,
      formattedForTx: `${finalAmount.toFixed(WAXDAO_PRECISION)} WAXDAO`,
      displayAmount: `${Math.ceil(finalAmount).toLocaleString()} WAXDAO`,
      waxdaoWaxPrice,
      isLoading,
      isAvailable: true,
      refetch,
    };
  }, [prices, isLoading, refetch]);
}
