import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { fetchSwapRoute, type SwapToken, type SwapRoute } from "@/lib/swapApi";
import { computeAlcorTrade } from "@/lib/alcorRouter";
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
      // Race the SDK split router against Alcor's canonical HTTP router and
      // pick the better result. HTTP runs against Alcor's live pool state and
      // is the upper-bound quote; SDK can sometimes beat it by exploring
      // finer splits, so we don't want to blindly use either.
      const sdkPromise = computeAlcorTrade({
        tokenIn: tokenIn!,
        tokenOut: tokenOut!,
        amount: debouncedAmount,
        slippage,
        receiver,
        tradeType: debouncedTradeType,
        signal,
      });
      const httpPromise = fetchSwapRoute(
        tokenIn!,
        tokenOut!,
        debouncedAmount,
        slippage,
        receiver,
        signal,
        debouncedTradeType
      );

      const [sdkSettled, httpSettled] = await Promise.allSettled([sdkPromise, httpPromise]);

      // AbortErrors always bubble so React Query can cancel cleanly.
      for (const s of [sdkSettled, httpSettled]) {
        if (s.status === "rejected" && (s.reason as any)?.name === "AbortError") {
          throw s.reason;
        }
      }

      const sdk = sdkSettled.status === "fulfilled" ? sdkSettled.value : null;
      const http = httpSettled.status === "fulfilled" ? httpSettled.value : null;
      const sdkErr = sdkSettled.status === "rejected" ? sdkSettled.reason : null;
      const httpErr = httpSettled.status === "rejected" ? httpSettled.reason : null;
      if (sdkErr) logger.warn("[alcor-router] SDK failed", sdkErr);
      if (httpErr) logger.warn("[alcor-router] HTTP failed", httpErr);

      const sdkValid = !!sdk && sdk.swaps.length > 0 && sdk.output > 0;
      const httpValid = !!http && !!http.memo && http.output > 0;

      if (!sdkValid && !httpValid) {
        // If either side failed with a transient network/rate-limit error,
        // throw so React Query retries with backoff instead of showing "no route".
        if (sdkErr && isTransientError(sdkErr)) throw sdkErr;
        if (httpErr && isTransientError(httpErr)) throw httpErr;
        if (sdkErr) throw sdkErr;
        if (httpErr) throw httpErr;
        // Both empty/null with no error → genuine "no route".
        return null;
      }
      if (!sdkValid) return http!;
      if (!httpValid) return sdk!;

      const exactIn = debouncedTradeType === "EXACT_INPUT";
      // Pick the user-better side.
      let winner: SwapRoute;
      let winnerName: "SDK" | "HTTP";
      if (exactIn) {
        if (sdk!.output >= http!.output) {
          winner = sdk!;
          winnerName = "SDK";
        } else {
          winner = http!;
          winnerName = "HTTP";
        }
      } else {
        // EXACT_OUTPUT: lower input wins. Fall back to output-max if input is missing.
        const sdkIn = sdk!.input ?? Number.POSITIVE_INFINITY;
        const httpIn = http!.input ?? Number.POSITIVE_INFINITY;
        if (sdkIn <= httpIn) {
          winner = sdk!;
          winnerName = "SDK";
        } else {
          winner = http!;
          winnerName = "HTTP";
        }
      }

      const delta = exactIn
        ? ((winner.output - Math.min(sdk!.output, http!.output)) /
            Math.max(1e-12, Math.min(sdk!.output, http!.output))) *
          100
        : 0;
      logger.info(
        `[alcor-router] winner=${winnerName} sdkOut=${sdk!.output} httpOut=${http!.output} Δ=${delta.toFixed(4)}%`
      );
      return winner;
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
