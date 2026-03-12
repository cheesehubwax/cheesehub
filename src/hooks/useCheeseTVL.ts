import { useQuery } from '@tanstack/react-query';
import { fetchCheeseTotalTVL, TVLData } from '@/lib/tvl';

export function useCheeseTVL(waxUsdPrice: number | undefined, cheeseUsdPrice: number | undefined) {
  return useQuery<TVLData>({
    queryKey: ['cheese-tvl'],
    queryFn: () => fetchCheeseTotalTVL(waxUsdPrice || 0, cheeseUsdPrice || 0),
    enabled: !!waxUsdPrice && waxUsdPrice > 0 && !!cheeseUsdPrice && cheeseUsdPrice > 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60 * 60 * 1000, // 1 hour - manual refresh only
    retry: 2,
  });
}
