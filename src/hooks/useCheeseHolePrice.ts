import { useQuery } from "@tanstack/react-query";

const POOL_URL = "https://wax.alcor.exchange/api/v2/swap/pools/11051";

interface PoolResponse {
  priceA?: number;
  priceB?: number;
}

/**
 * CHEESE/HOLE price from Alcor pool 11051.
 * priceB = CHEESE per 1 HOLE (tokenA=CHEESE, tokenB=HOLE).
 */
export function useCheeseHolePrice() {
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["cheese-hole-price"],
    queryFn: async ({ signal }): Promise<{ cheesePerHole: number }> => {
      const res = await fetch(POOL_URL, { signal });
      if (!res.ok) throw new Error(`pool 11051 fetch failed: ${res.status}`);
      const json = (await res.json()) as PoolResponse;
      return { cheesePerHole: Number(json.priceB ?? 0) };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    cheesePerHole: data?.cheesePerHole ?? 0,
    isLoading,
    isFetching,
    refetch,
    error,
  };
}