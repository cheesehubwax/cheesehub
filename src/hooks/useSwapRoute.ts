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
    }, 1200);
    return () => clearTimeout(timer);
  }, [amount, tradeType]);

  const tokensIdentical =
    !!tokenIn && !!tokenOut && tokenIn.ticker === tokenOut.ticker && tokenIn.contract === tokenOut.contract;

  const enabled =
    !!tokenIn && !!tokenOut && !tokensIdentical && !!debouncedAmount && parseFloat(debouncedAmount) > 0 && !!receiver && receiver !== "placeholder111";

  const { data: route, isLoading, error, isFetching, failureCount } = useQuery<SwapRoute | null>({
    queryKey: ["swap-route", tokenIn?.ticker, tokenIn?.contract, tokenOut?.ticker, tokenOut?.contract, debouncedAmount, slippage, receiver, debouncedTradeType],
    queryFn: ({ signal }) => fetchSwapRoute(tokenIn!, tokenOut!, debouncedAmount, slippage, receiver, signal, debouncedTradeType),
    enabled,
    staleTime: 15_000,
    gcTime: 30_000,
    retry: (failureCount, err) => {
      const msg = err instanceof Error ? err.message : '';
      const isTransient =
        msg.includes('Rate limited') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('Load failed') ||
        (err instanceof TypeError);
      if (isTransient) return failureCount < 3;
      return failureCount < 1;
    },
    retryDelay: (attemptIndex, err) => {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Rate limited')) return Math.min(5000 * 2 ** attemptIndex, 30000);
      return Math.min(1000 * 2 ** attemptIndex, 4000);
    },
  });

  const noRoute = enabled && !isLoading && !isFetching && !error && route === null;

  // While we have an error but the query is still actively retrying (or about
  // to), treat it as transient and don't surface a red banner to the user.
  const isRetrying = !!error && (isFetching || failureCount < 3);

  return {
    route: route ?? undefined,
    isLoading: isLoading && enabled,
    isFetching,
    error,
    noRoute,
    isRetrying,
  };
}
