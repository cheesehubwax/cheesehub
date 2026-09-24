import { useQuery } from '@tanstack/react-query';
import { fetchCheeseTotalTVL, TVLData } from '@/lib/tvl';
import { cached, readStatCache } from '@/lib/statCache';

const CACHE_KEY = 'cheese-tvl';

export function useCheeseTVL(waxUsdPrice: number | undefined, cheeseUsdPrice: number | undefined) {
  return useQuery<TVLData>({
    queryKey: ['cheese-tvl'],
    queryFn: cached(CACHE_KEY, () => fetchCheeseTotalTVL(waxUsdPrice || 0, cheeseUsdPrice || 0)),
    // Show the last good TVL straight away while the fresh one loads.
    placeholderData: () => readStatCache<TVLData>(CACHE_KEY),
    enabled: !!waxUsdPrice && waxUsdPrice > 0 && !!cheeseUsdPrice && cheeseUsdPrice > 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60 * 60 * 1000, // 1 hour - manual refresh only
    retry: 2,
  });
}
