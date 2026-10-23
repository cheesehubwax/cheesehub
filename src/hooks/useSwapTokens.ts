import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { fetchSwapTokenList, snapshotSwapTokens, POPULAR_TICKERS, type SwapToken } from "@/lib/swapApi";
import { readTokenSnapshot } from '@/lib/tokenSnapshot';
import { initializeTokenCacheFromData } from "@/lib/tokenLogos";
import { cached, readStatCache } from "@/lib/statCache";

const CACHE_KEY = "swap-tokens";

export function useSwapTokens(livePrices = false) {
  const [search, setSearch] = useState("");

  const { data: tokens = [], isLoading, error, refetch, isFetching, dataUpdatedAt, isPlaceholderData } = useQuery({
    queryKey: ["swap-tokens"],
    queryFn: ({ signal }) => cached(CACHE_KEY, () => fetchSwapTokenList(signal))(),
    // Prices show from the last good list while the fresh one loads.
    placeholderData: () => {
      const cachedTokens = readStatCache<SwapToken[]>(CACHE_KEY);
      if (cachedTokens?.length) return cachedTokens;
      const snapshot = readTokenSnapshot();
      return snapshot ? snapshotSwapTokens(snapshot) : undefined;
    },
    staleTime: livePrices ? 60_000 : 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: livePrices ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: livePrices ? 'always' : false,
    refetchOnMount: livePrices ? 'always' : false,
    refetchOnReconnect: livePrices ? 'always' : false,
  });

  // Populate the global token logo cache from the shared query
  useEffect(() => {
    if (tokens.length > 0) {
      initializeTokenCacheFromData(
        tokens.map((t) => ({ symbol: t.ticker, contract: t.contract }))
      );
    }
  }, [tokens]);

  const popularTokens = useMemo(
    () => POPULAR_TICKERS.map((t) => tokens.find((tk) => tk.ticker === t)).filter(Boolean) as SwapToken[],
    [tokens]
  );

  const filteredTokens = useMemo(() => {
    if (!search.trim()) return tokens;
    const q = search.toLowerCase();
    return tokens.filter(
      (t) => t.ticker.toLowerCase().includes(q) || t.contract.toLowerCase().includes(q)
    );
  }, [tokens, search]);

  return { tokens, filteredTokens, popularTokens, isLoading, error, search, setSearch, refetch, isFetching, dataUpdatedAt, isPlaceholderData };
}
