import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { fetchSwapRoute, type SwapToken, type SwapRoute } from "@/lib/swapApi";
import { computeAlcorTrade, isAlcorCoolingDown } from "@/lib/alcorRouter";
import { logger } from "@/lib/logger";

export type TradeType = "EXACT_INPUT" | "EXACT_OUTPUT";

const MAX_TRANSIENT_RETRIES = 3;

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
    }, 350);
    return () => clearTimeout(timer);
  }, [amount, tradeType]);

  const tokensIdentical =
    !!tokenIn && !!tokenOut && tokenIn.ticker === tokenOut.ticker && tokenIn.contract === tokenOut.contract;

  const enabled =
    !!tokenIn && !!tokenOut && !tokensIdentical && !!debouncedAmount && parseFloat(debouncedAmount) > 0 && !!receiver && receiver !== "placeholder111";

  const { data: route, isLoading, error, isFetching, failureCount, refetch } = useQuery<SwapRoute | null>({
    queryKey: ["swap-route", tokenIn?.ticker, tokenIn?.contract, tokenOut?.ticker, tokenOut?.contract, debouncedAmount, slippage, receiver, debouncedTradeType],
    queryFn: async ({ signal }) => {
      // Race Alcor's HTTP router against the SDK split router and pick the
      // better quote. HTTP is cheap and usually single-path; the SDK can
      // produce multi-split routes that beat HTTP on larger sizes. During an
      // Alcor 429 cooldown we skip the SDK leg so we don't worsen rate
      // limiting (matches previous fallback behavior).
      const httpPromise = fetchSwapRoute(
        tokenIn!,
        tokenOut!,
        debouncedAmount,
        slippage,
        receiver,
        signal,
        debouncedTradeType,
      );

      const sdkPromise = isAlcorCoolingDown()
        ? Promise.resolve(null as SwapRoute | null)
        : computeAlcorTrade({
            tokenIn: tokenIn!,
            tokenOut: tokenOut!,
            amount: debouncedAmount,
            slippage,
            receiver,
            tradeType: debouncedTradeType,
            signal,
          }).catch((e) => {
            if ((e as any)?.name === "AbortError") throw e;
            logger.warn("[alcor-router] SDK leg failed", e);
            return null;
          });

      const [httpSettled, sdkSettled] = await Promise.allSettled([httpPromise, sdkPromise]);

      // Abort propagation
      for (const s of [httpSettled, sdkSettled]) {
        if (s.status === "rejected" && (s.reason as any)?.name === "AbortError") {
          throw s.reason;
        }
      }

      const http =
        httpSettled.status === "fulfilled" ? (httpSettled.value as SwapRoute | null) : null;
      const sdk =
        sdkSettled.status === "fulfilled" ? (sdkSettled.value as SwapRoute | null) : null;

      const httpValid = !!http && !!http.memo && http.output > 0;
      const sdkValid = !!sdk && sdk.swaps.length > 0 && sdk.output > 0 && !!sdk.memo;

      // Prefer SDK only when it's a real multi-split AND strictly better than
      // HTTP by a small threshold, to avoid flip-flopping on ties.
      const IMPROVEMENT_THRESHOLD = 0.0005; // 0.05%
      const exactIn = debouncedTradeType === "EXACT_INPUT";

      const pickSdk = (): boolean => {
        if (!sdkValid) return false;
        if (sdk!.swaps.length < 2) return false;
        if (!httpValid) return true;
        if (exactIn) {
          // Larger output wins.
          return sdk!.output > http!.output * (1 + IMPROVEMENT_THRESHOLD);
        }
        // EXACT_OUTPUT: smaller input wins. Fall back to HTTP if either input missing.
        if (sdk!.input == null || http!.input == null) return false;
        return sdk!.input < http!.input * (1 - IMPROVEMENT_THRESHOLD);
      };

      if (pickSdk()) {
        const delta = exactIn
          ? (sdk!.output - (http?.output ?? 0)) / Math.max(http?.output ?? 1, 1e-9)
          : ((http?.input ?? 0) - (sdk!.input ?? 0)) / Math.max(http?.input ?? 1, 1e-9);
        logger.info(
          `[alcor-router] SDK won (${sdk!.swaps.length} splits, +${(delta * 100).toFixed(3)}%)`,
        );
        return sdk!;
      }

      if (httpValid) {
        if (sdkValid) {
          logger.info(
            `[alcor-router] HTTP won (sdk splits=${sdk!.swaps.length}, sdk out=${sdk!.output}, http out=${http!.output})`,
          );
        }
        return http!;
      }

      // Neither valid — propagate errors if any, else null.
      if (httpSettled.status === "rejected") throw httpSettled.reason;
      if (sdkSettled.status === "rejected") throw sdkSettled.reason;
      return null;
    },
    enabled,
    staleTime: 15_000,
    gcTime: 30_000,
    retryOnMount: true,
    placeholderData: (prev) => prev,
    retry: (count, err) => {
      if (isTransientError(err)) return count < MAX_TRANSIENT_RETRIES;
      return count < 1;
    },
    retryDelay: (attemptIndex, err) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Rate limited")) return Math.min(5000 * 2 ** attemptIndex, 30000);
      // 300ms, 600ms, 1.2s, cap 4s — fast recovery on flaky networks.
      return Math.min(300 * 2 ** attemptIndex, 4000);
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
    }, 8_000);
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
