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

      if (sdkError && sdkTransient && !httpValid) {
        logger.warn("[alcor-router] SDK quote not final and HTTP unavailable; retrying", sdkError);
        throw sdkError;
      }

      if (sdkError && sdkTransient && httpValid) {
        logger.warn("[alcor-router] SDK quote rate-limited; using HTTP fallback instead of crashing", sdkError);
      }

      if (sdkError) {
        logger.warn("[alcor-router] SDK failed definitively; HTTP fallback allowed", sdkError);
      }

      // Prefer the SDK whenever its real multi-split improves the quote at all.
      // Alcor's own UI can pick splits whose edge is user-visible but small, so
      // avoid a threshold that keeps a worse 100% route on screen.
      const exactIn = debouncedTradeType === "EXACT_INPUT";

      // Extrapolate what each leg would produce (EXACT_INPUT) or require
      // (EXACT_OUTPUT) if it were routed at 100% — linear approximation, but
      // good enough to detect the "greedy split landed worse than one of its
      // own legs" pathology. If the split total loses to a single leg, the
      // split is objectively worse and we fall back to HTTP.
      const splitLosesToSingleLeg = (r: SwapRoute): boolean => {
        if (!r.swaps.length) return false;
        if (exactIn) {
          const best = r.swaps.reduce((m, s) => {
            const pct = s.percent > 0 ? s.percent / 100 : 0;
            if (!pct) return m;
            const scaled = parseFloat(s.output as unknown as string) / pct;
            return scaled > m ? scaled : m;
          }, 0);
          return best > r.output * 1.0001; // require a meaningful loss
        }
        if (r.input == null) return false;
        const best = r.swaps.reduce((m, s) => {
          const pct = s.percent > 0 ? s.percent / 100 : 0;
          if (!pct) return m === Infinity ? m : m;
          const scaled = parseFloat(s.input as unknown as string) / pct;
          return scaled < m ? scaled : m;
        }, Infinity);
        return best < (r.input as number) / 1.0001;
      };

      const pickSdk = (): boolean => {
        if (!sdkValid) return false;
        if (sdk!.swaps.length < 2) return false;
        if (splitLosesToSingleLeg(sdk!)) {
          logger.warn(
            `[alcor-router] SDK split rejected: worse than its own best single leg (splits=${sdk!.swaps.length}, out=${sdk!.output})`,
          );
          return false;
        }
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
          `[alcor-router] SDK won (${sdk!.swaps.length} splits, +${(delta * 100).toFixed(4)}%, complete=${sdk!.quoteComplete !== false}, ${sdk!.quoteDiagnostics?.routesConsidered ?? "?"} routes, ${sdk!.quoteDiagnostics?.poolsBuilt ?? "?"}/${sdk!.quoteDiagnostics?.relevantPools ?? "?"} pools, ${sdk!.quoteDiagnostics?.ticksSucceeded ?? "?"}/${sdk!.quoteDiagnostics?.tickRequests ?? "?"} ticks, rateLimited=${sdk!.quoteDiagnostics?.rateLimitedTickFailures ?? 0}, ${sdk!.quoteDiagnostics?.tookMs ?? "?"}ms)`,
        );
        return { ...sdk!, quoteComplete: sdk!.quoteComplete !== false };
      }

      if (sdk && sdk.quoteComplete === false) {
        const diag = sdk.quoteDiagnostics;
        if (!httpValid) {
          const retryError = new Error(
            `Failed to fetch complete split route — retrying (${diag?.routesConsidered ?? "?"} routes, ${diag?.poolsBuilt ?? "?"}/${diag?.relevantPools ?? "?"} pools, tickFailures=${diag?.tickFailures ?? 0})`,
          );
          logger.warn("[alcor-router] SDK route incomplete and HTTP unavailable; retrying", retryError);
          throw retryError;
        }
        logger.warn(
          `[alcor-router] SDK route incomplete and did not beat HTTP; using HTTP fallback (sdk splits=${sdk.swaps.length}, sdk out=${sdk.output}, http out=${http!.output}, tickFailures=${diag?.tickFailures ?? 0}, rateLimited=${diag?.rateLimitedTickFailures ?? 0})`,
        );
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
