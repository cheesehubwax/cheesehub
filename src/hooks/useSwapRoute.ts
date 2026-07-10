import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { fetchSwapRoute, type SwapToken, type SwapRoute } from "@/lib/swapApi";
import { computeAlcorTrade } from "@/lib/alcorRouter";
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

function isAbortError(err: unknown): boolean {
  return (err as any)?.name === "AbortError";
}

function isValidHttpRoute(route: SwapRoute | null | undefined): route is SwapRoute {
  return !!route && !!route.memo && route.output > 0;
}

function isValidSdkRoute(route: SwapRoute | null | undefined): route is SwapRoute {
  return !!route && !!route.memo && route.output > 0 && route.swaps.length > 0;
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
      // Run both quote engines and do not let the cheap HTTP route look final
      // until the SDK split router has completed. If the SDK is temporarily
      // blocked by rate limits/missing pool data, retry instead of exposing a
      // worse 100% route as the best available price.
      const httpPromise = fetchSwapRoute(
        tokenIn!,
        tokenOut!,
        debouncedAmount,
        slippage,
        receiver,
        signal,
        debouncedTradeType,
      );

      const sdkPromise = computeAlcorTrade({
        tokenIn: tokenIn!,
        tokenOut: tokenOut!,
        amount: debouncedAmount,
        slippage,
        receiver,
        tradeType: debouncedTradeType,
        signal,
      });

      const [httpSettled, sdkSettled] = await Promise.allSettled([httpPromise, sdkPromise]);

      // Abort propagation
      for (const s of [httpSettled, sdkSettled]) {
        if (s.status === "rejected" && isAbortError(s.reason)) {
          throw s.reason;
        }
      }

      const http =
        httpSettled.status === "fulfilled" ? (httpSettled.value as SwapRoute | null) : null;
      const sdk =
        sdkSettled.status === "fulfilled" ? (sdkSettled.value as SwapRoute | null) : null;

      const httpValid = isValidHttpRoute(http);
      const sdkValid = isValidSdkRoute(sdk);

      const sdkError = sdkSettled.status === "rejected" ? sdkSettled.reason : null;
      const sdkTransient = sdkError ? isTransientError(sdkError) : false;

      if (sdkError && sdkTransient) {
        logger.warn("[alcor-router] SDK quote not final; retrying before accepting HTTP fallback", sdkError);
        throw sdkError;
      }

      if (sdkError) {
        logger.warn("[alcor-router] SDK failed definitively; HTTP fallback allowed", sdkError);
      }

      // Prefer the SDK whenever its real multi-split improves the quote at all.
      // Alcor's own UI can pick splits whose edge is user-visible but small, so
      // avoid a threshold that keeps a worse 100% route on screen.
      const exactIn = debouncedTradeType === "EXACT_INPUT";

      const pickSdk = (): boolean => {
        if (!sdkValid) return false;
        if (sdk!.swaps.length < 2) return false;
        if (!httpValid) return true;
        if (exactIn) {
          // Larger output wins.
          return sdk!.output > http!.output;
        }
        // EXACT_OUTPUT: smaller input wins. Fall back to HTTP if either input missing.
        if (sdk!.input == null || http!.input == null) return false;
        return sdk!.input < http!.input;
      };

      if (pickSdk()) {
        const delta = exactIn
          ? (sdk!.output - (http?.output ?? 0)) / Math.max(http?.output ?? 1, 1e-9)
          : ((http?.input ?? 0) - (sdk!.input ?? 0)) / Math.max(http?.input ?? 1, 1e-9);
        logger.info(
          `[alcor-router] SDK won (${sdk!.swaps.length} splits, +${(delta * 100).toFixed(4)}%, ${sdk!.quoteDiagnostics?.routesConsidered ?? "?"} routes, ${sdk!.quoteDiagnostics?.poolsBuilt ?? "?"}/${sdk!.quoteDiagnostics?.relevantPools ?? "?"} pools, ${sdk!.quoteDiagnostics?.tookMs ?? "?"}ms)`,
        );
        return { ...sdk!, quoteComplete: true };
      }

      if (httpValid) {
        if (sdkValid) {
          logger.info(
            `[alcor-router] HTTP won after SDK check (sdk splits=${sdk!.swaps.length}, sdk out=${sdk!.output}, http out=${http!.output}, ${sdk!.quoteDiagnostics?.routesConsidered ?? "?"} routes, ${sdk!.quoteDiagnostics?.poolsBuilt ?? "?"}/${sdk!.quoteDiagnostics?.relevantPools ?? "?"} pools)`,
          );
        } else {
          logger.info("[alcor-router] HTTP won after SDK returned no valid split route");
        }
        return { ...http!, quoteComplete: true };
      }

      // Neither valid — propagate errors if any, else null.
      if (httpSettled.status === "rejected") throw httpSettled.reason;
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
