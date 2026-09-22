import { useQuery } from '@tanstack/react-query';
import { getCheeseStats, type CheeseStats } from '@/lib/cheeseStats';
import { cached, readStatCache } from '@/lib/statCache';

const CACHE_KEY = 'cheese-stats';

export function useCheeseStats() {
  return useQuery<CheeseStats>({
    queryKey: ['cheese-stats'],
    queryFn: cached(CACHE_KEY, getCheeseStats),
    // Paint the last good numbers straight away, then replace them when the
    // chain answers. Without this the boxes stay blank for the whole read.
    placeholderData: () => readStatCache<CheeseStats>(CACHE_KEY),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}
