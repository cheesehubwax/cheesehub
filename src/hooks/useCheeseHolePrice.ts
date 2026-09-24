import { useQuery } from "@tanstack/react-query";
import { cached, readStatCache } from "@/lib/statCache";

const POOL_URL = "https://wax.alcor.exchange/api/v2/swap/pools/11051";
const CACHE_KEY = "cheese-hole-price";
const TIMEOUT_MS = 8_000;

interface PoolResponse {
  priceA?: number;
  priceB?: number;
}

interface HolePriceData {
  cheesePerHole: number;
}

async function fetchHolePrice(): Promise<HolePriceData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(POOL_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`pool 11051 fetch failed: ${res.status}`);
    const json = (await res.json()) as PoolResponse;
    return { cheesePerHole: Number(json.priceB ?? 0) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * CHEESE/HOLE price from Alcor pool 11051.
 * priceB = CHEESE per 1 HOLE (tokenA=CHEESE, tokenB=HOLE).
 * Shows the last saved value instantly while refreshing, like the other stats.
 */
export function useCheeseHolePrice() {
  const { data, isLoading, isFetching, refetch, error } = useQuery<HolePriceData>({
    queryKey: ["cheese-hole-price"],
    queryFn: cached(CACHE_KEY, fetchHolePrice),
    placeholderData: () => readStatCache<HolePriceData>(CACHE_KEY),
    staleTime: 60_000,
    retry: 1,
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
