import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { fetchSwapRoute, type SwapToken, type SwapRoute } from "@/lib/swapApi";
import { computeAlcorTrade } from "@/lib/alcorRouter";
import { logger } from "@/lib/logger";

export type TradeType = "EXACT_INPUT" | "EXACT_OUTPUT";

const MAX_TRANSIENT_RETRIES = 1;
const SDK_TIMEOUT_MS = 6000;

function withTimeout<T>(p: Promise<T>, ms: number, ctrl: AbortController): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      ctrl.abort();
      reject(new Error("SDK_TIMEOUT"));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

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
      // Try SDK split router first; on failure or empty result fall back to
      // Alcor's HTTP getRoute. Keep this to one attempt so Alcor 502/CORS
      // failures don't amplify into a request storm.
      const sdkCtrl = new AbortController();
      const onOuterAbort = () => sdkCtrl.abort();
      signal?.addEventListener("abort", onOuterAbort);
      try {
        const sdk = await withTimeout(
          computeAlcorTrade({
            tokenIn: tokenIn!,
            tokenOut: tokenOut!,
            amount: debouncedAmount,
            slippage,
            receiver,
            tradeType: debouncedTradeType,
            signal: sdkCtrl.signal,
          }),
          SDK_TIMEOUT_MS,
          sdkCtrl
        );
        if (sdk && sdk.swaps.length > 0 && sdk.output > 0) {
          logger.info("[alcor-router] SDK quote used", {
            splits: sdk.swaps.length,
            output: sdk.output,
            priceImpact: sdk.priceImpact,
          });
          return sdk;
        }
        logger.warn("[alcor-router] SDK returned no route — falling back to HTTP");
      } catch (e) {
        // Only bail out if the outer (React Query) signal aborted. An internal
        // AbortError from our timeout controller should fall through to HTTP.
        if (signal?.aborted) throw e;
        const msg = (e as any)?.message;
        if (msg === "SDK_TIMEOUT") {
          logger.warn("[alcor-router] SDK timed out — falling back to HTTP");
        } else {
          logger.warn("[alcor-router] SDK failed — falling back to HTTP", e);
        }
      } finally {
        signal?.removeEventListener("abort", onOuterAbort);
      }
      return fetchSwapRoute(tokenIn!, tokenOut!, debouncedAmount, slippage, receiver, signal, debouncedTradeType);
    },
    enabled,
    staleTime: 15_000,
    gcTime: 30_000,
    retryOnMount: false,
    retry: (count, err) => {
      if (isTransientError(err)) return count < MAX_TRANSIENT_RETRIES;
      return count < 1;
    },
    retryDelay: (attemptIndex, err) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Rate limited")) return Math.min(5000 * 2 ** attemptIndex, 30000);
      return Math.min(1000 * 2 ** attemptIndex, 5000);
    },
  });

  const noRoute = enabled && !isLoading && !isFetching && !error && route === null;

  const transient = !!error && isTransientError(error);

  // Stay "retrying" for the full window so the gap between attempts (when
  // isFetching is briefly false) doesn't flash the red banner.
  const isRetrying = transient && failureCount < MAX_TRANSIENT_RETRIES;
  const finalError = error && !transient ? error : null;
  const exhaustedTransient = transient && failureCount >= MAX_TRANSIENT_RETRIES;

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
