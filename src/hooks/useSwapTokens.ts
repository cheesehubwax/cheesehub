import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { fetchSwapTokenList, POPULAR_TICKERS, type SwapToken } from "@/lib/swapApi";
import { initializeTokenCacheFromData } from "@/lib/tokenLogos";

export function useSwapTokens() {
  const [search, setSearch] = useState("");

  const { data: tokens = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["swap-tokens"],
    queryFn: ({ signal }) => fetchSwapTokenList(signal),
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
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

  return { tokens, filteredTokens, popularTokens, isLoading, error, search, setSearch, refetch, isFetching };
}
