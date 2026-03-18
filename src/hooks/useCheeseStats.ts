import { useQuery } from '@tanstack/react-query';
import { getCheeseStats, type CheeseStats } from '@/lib/cheeseStats';

export function useCheeseStats() {
  return useQuery<CheeseStats>({
    queryKey: ['cheese-stats'],
    queryFn: getCheeseStats,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}
