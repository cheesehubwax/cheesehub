import { useQuery } from '@tanstack/react-query';
import { fetchLogburnActions, aggregateNullerStats, type NullerStats, type LogburnAction } from '@/lib/fetchLeaderboard';

export function useNullerLeaderboard() {
  const query = useQuery<LogburnAction[]>({
    queryKey: ['nuller-leaderboard'],
    queryFn: fetchLogburnActions,
    staleTime: Infinity,
  });

  const allStats = query.data ? aggregateNullerStats(query.data, 'cheese') : [];

  return {
    rawActions: query.data || [],
    data: allStats,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
