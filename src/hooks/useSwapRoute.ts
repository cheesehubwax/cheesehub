import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { fetchSwapRoute, type SwapToken, type SwapRoute } from "@/lib/swapApi";
import { computeAlcorTrade, isAlcorCoolingDown } from "@/lib/alcorRouter";
import { logger } from "@/lib/logger";

export type TradeType = "EXACT_INPUT" | "EXACT_OUTPUT";

const MAX_TRANSIENT_RETRIES = 6;

function isTransientError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : "";
  return (
    msg.includes("Rate limited") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Load failed") ||
    msg.includes("network")
  );
}

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

  const { data: route, isLoading, error, isFetching, failureCount, refetch } = useQuery<SwapRoute | null>({
    queryKey: ["swap-route", tokenIn?.ticker, tokenIn?.contract, tokenOut?.ticker, tokenOut?.contract, debouncedAmount, slippage, receiver, debouncedTradeType],
    queryFn: async ({ signal }) => {
      // Primary quote: Alcor's HTTP router — one request, cheap, uses live
      // pool state. This is the only path that runs on the hot input loop.
      const http = await fetchSwapRoute(
        tokenIn!,
        tokenOut!,
        debouncedAmount,
        slippage,
        receiver,
        signal,
        debouncedTradeType,
      );

      const httpValid = !!http && !!http.memo && http.output > 0;
      if (httpValid) return http!;

      // HTTP returned an empty/no-route response with no error. Try the SDK
      // split router as a fallback — but only if we're not in an Alcor
      // cooldown, otherwise we'd fan out dozens of /ticks requests and make
      // rate limiting worse.
      if (isAlcorCoolingDown()) return null;

      try {
        const sdk = await computeAlcorTrade({
          tokenIn: tokenIn!,
          tokenOut: tokenOut!,
          amount: debouncedAmount,
          slippage,
          receiver,
          tradeType: debouncedTradeType,
          signal,
        });
        if (sdk && sdk.swaps.length > 0 && sdk.output > 0) {
          logger.info("[alcor-router] SDK fallback produced route");
          return sdk;
        }
      } catch (e) {
        if ((e as any)?.name === "AbortError") throw e;
        logger.warn("[alcor-router] SDK fallback failed", e);
        if (isTransientError(e)) throw e;
      }
      return null;
    },
    enabled,
    staleTime: 15_000,
    gcTime: 30_000,
    retryOnMount: true,
    retry: (count, err) => {
      if (isTransientError(err)) return count < MAX_TRANSIENT_RETRIES;
      return count < 1;
    },
    retryDelay: (attemptIndex, err) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Rate limited")) return Math.min(5000 * 2 ** attemptIndex, 30000);
      // 1s, 2s, 4s, 8s, 12s, 15s (cap)
      return Math.min(1000 * 2 ** attemptIndex, 15000);
    },
  });

  const noRoute = enabled && !isLoading && !isFetching && !error && route === null;

  const transient = !!error && isTransientError(error);

  // Stay "retrying" for the full window so the gap between attempts (when
  // isFetching is briefly false) doesn't flash the red banner.
  const isRetrying = transient && failureCount < MAX_TRANSIENT_RETRIES;
  const finalError = error && !transient ? error : null;
  const exhaustedTransient = transient && failureCount >= MAX_TRANSIENT_RETRIES;

  // Self-heal: after exhausting retries on a transient failure, schedule a
  // single delayed refetch so the widget recovers without user input.
  const healTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!exhaustedTransient || !enabled) return;
    healTimerRef.current = setTimeout(() => {
      refetch();
    }, 20_000);
    return () => {
      if (healTimerRef.current) clearTimeout(healTimerRef.current);
      healTimerRef.current = null;
    };
  }, [exhaustedTransient, enabled, refetch]);

  return {
    route: route ?? undefined,
    isLoading: isLoading && enabled,
    isFetching,
    error: finalError,
    finalError,
    noRoute,
    isRetrying,
    exhaustedTransient,
    refetch,
  };
}
