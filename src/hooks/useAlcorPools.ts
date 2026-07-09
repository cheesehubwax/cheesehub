import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchAlcorPool, type AlcorPool } from "@/lib/swapApi";
import { isAlcorCoolingDown } from "@/lib/alcorRouter";

export function useAlcorPools(ids: number[]) {
  const uniqueIds = useMemo(() => Array.from(new Set(ids)).sort((a, b) => a - b), [ids]);

  const results = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: ["alcor-pool", id],
      queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAlcorPool(id, signal),
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      // Skip while Alcor is rate-limiting us; route details are cosmetic and
      // must never contribute to the 429 storm.
      enabled: !isAlcorCoolingDown(),
      retry: 0,
    })),
  });

  const pools = useMemo(() => {
    const map = new Map<number, AlcorPool>();
    results.forEach((r, i) => {
      if (r.data) map.set(uniqueIds[i], r.data);
    });
    return map;
  }, [results, uniqueIds]);

  const isLoading = results.some((r) => r.isLoading);
  const hasError = results.some((r) => r.isError);

  return { pools, isLoading, hasError };
}