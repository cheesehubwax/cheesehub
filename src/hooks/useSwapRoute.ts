import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { fetchSwapRoute, type SwapToken, type SwapRoute } from "@/lib/swapApi";

export function useSwapRoute(
  tokenIn: SwapToken | null,
  tokenOut: SwapToken | null,
  amountIn: string,
  slippage: number,
  receiver: string
) {
  const [debouncedAmount, setDebouncedAmount] = useState(amountIn);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAmount(amountIn), 500);
    return () => clearTimeout(timer);
  }, [amountIn]);

  const tokensIdentical =
    !!tokenIn && !!tokenOut && tokenIn.ticker === tokenOut.ticker && tokenIn.contract === tokenOut.contract;

  const enabled =
    !!tokenIn && !!tokenOut && !tokensIdentical && !!debouncedAmount && parseFloat(debouncedAmount) > 0 && !!receiver && receiver !== "placeholder111";

  const { data: route, isLoading, error, isFetching } = useQuery<SwapRoute | null>({
    queryKey: ["swap-route", tokenIn?.ticker, tokenIn?.contract, tokenOut?.ticker, tokenOut?.contract, debouncedAmount, slippage, receiver],
    queryFn: ({ signal }) => fetchSwapRoute(tokenIn!, tokenOut!, debouncedAmount, slippage, receiver, signal),
    enabled,
    staleTime: 10_000,
    gcTime: 30_000,
    retry: 1,
  });

  const noRoute = enabled && !isLoading && !isFetching && !error && route === null;

  return { route: route ?? undefined, isLoading: isLoading && enabled, isFetching, error, noRoute };
}
