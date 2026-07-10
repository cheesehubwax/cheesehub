import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { AlcorPool } from "@/lib/swapApi";
import { fetchAllAlcorPools, isAlcorCoolingDown } from "@/lib/alcorRouter";

export function useAlcorPools(ids: number[]) {
  const uniqueIds = useMemo(
    () => Array.from(new Set(ids)).sort((a, b) => a - b),
    [ids]
  );

  // Piggy-back on the same bulk endpoint the router already calls to produce
  // the quote. The router primes its own in-memory cache on every quote, so
  // this query typically resolves immediately on the first render after a
  // quote lands — no per-pool fan-out, no waiting on the cooldown gate for N
  // separate requests.
  const query = useQuery({
    queryKey: ["alcor-all-pools"],
    queryFn: ({ signal }) => fetchAllAlcorPools(signal),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    enabled: !isAlcorCoolingDown(),
    retry: 2,
    retryDelay: (attempt: number) => Math.min(500 * 2 ** attempt, 3000),
    placeholderData: (prev) => prev,
  });

  const pools = useMemo(() => {
    const map = new Map<number, AlcorPool>();
    const list = query.data;
    if (!list) return map;
    const wanted = new Set(uniqueIds);
    for (const p of list) {
      if (!wanted.has(p.id)) continue;
      // RawAlcorPool from the router is structurally identical to AlcorPool
      // for the fields MultiRoutePanel reads (id, fee, tokenA/tokenB).
      map.set(p.id, p as unknown as AlcorPool);
    }
    return map;
  }, [query.data, uniqueIds]);

  const isLoading = query.isLoading;
  const isReady = uniqueIds.length > 0 && uniqueIds.every((id) => pools.has(id));
  const hasError = query.isError;

  return { pools, isLoading, isReady, hasError };
}