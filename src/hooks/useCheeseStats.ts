import { useQuery } from '@tanstack/react-query';
import { getCheeseStats, type CheeseStats } from '@/lib/cheeseStats';

export function useCheeseStats() {
  return useQuery<CheeseStats>({
    queryKey: ['cheese-stats'],
    queryFn: getCheeseStats,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: 60 * 1000, // Refresh every minute
    retry: 2,
  });
}
