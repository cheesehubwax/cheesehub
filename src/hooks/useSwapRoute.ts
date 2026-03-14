import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { fetchSwapRoute, type SwapToken, type SwapRoute } from "@/lib/swapApi";

export type TradeType = "EXACT_INPUT" | "EXACT_OUTPUT";

export function useSwapRoute(
  tokenIn: SwapToken | null,
  tokenOut: SwapToken | null,
  amount: string,
  slippage: number,
  receiver: string,
  tradeType: TradeType = "EXACT_INPUT"
) {
  const [debouncedAmount, setDebouncedAmount] = useState(amount);
  const [debouncedTradeType, setDebouncedTradeType] = useState(tradeType);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAmount(amount);
      setDebouncedTradeType(tradeType);
    }, 800);
    return () => clearTimeout(timer);
  }, [amount, tradeType]);

  const tokensIdentical =
    !!tokenIn && !!tokenOut && tokenIn.ticker === tokenOut.ticker && tokenIn.contract === tokenOut.contract;

  const enabled =
    !!tokenIn && !!tokenOut && !tokensIdentical && !!debouncedAmount && parseFloat(debouncedAmount) > 0 && !!receiver && receiver !== "placeholder111";

  const { data: route, isLoading, error, isFetching } = useQuery<SwapRoute | null>({
    queryKey: ["swap-route", tokenIn?.ticker, tokenIn?.contract, tokenOut?.ticker, tokenOut?.contract, debouncedAmount, slippage, receiver, debouncedTradeType],
    queryFn: ({ signal }) => fetchSwapRoute(tokenIn!, tokenOut!, debouncedAmount, slippage, receiver, signal, debouncedTradeType),
    enabled,
    staleTime: 15_000,
    gcTime: 30_000,
    retry: 1,
    retryDelay: 3000,
  });

  const noRoute = enabled && !isLoading && !isFetching && !error && route === null;

  return { route: route ?? undefined, isLoading: isLoading && enabled, isFetching, error, noRoute };
}
