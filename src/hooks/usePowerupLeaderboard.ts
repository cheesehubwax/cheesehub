import { useQuery } from '@tanstack/react-query';
import { fetchPowerupTransfers, aggregatePowerupStats, type PowerupTransferAction } from '@/lib/fetchPowerupLeaderboard';

export function usePowerupLeaderboard() {
  const query = useQuery<PowerupTransferAction[]>({
    queryKey: ['powerup-leaderboard'],
    queryFn: fetchPowerupTransfers,
    staleTime: Infinity,
  });

  const allStats = query.data ? aggregatePowerupStats(query.data, 'cheese') : [];

  return {
    rawActions: query.data || [],
    data: allStats,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
