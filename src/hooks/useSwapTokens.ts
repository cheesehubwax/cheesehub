import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { fetchSwapTokenList, POPULAR_TICKERS, type SwapToken } from "@/lib/swapApi";

export function useSwapTokens() {
  const [search, setSearch] = useState("");

  const { data: tokens = [], isLoading, error } = useQuery({
    queryKey: ["swap-tokens"],
    queryFn: ({ signal }) => fetchSwapTokenList(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

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

  return { tokens, filteredTokens, popularTokens, isLoading, error, search, setSearch };
}
