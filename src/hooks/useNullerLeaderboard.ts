import { useQuery } from '@tanstack/react-query';
import {
  fetchLogburnActionsDetailed,
  aggregateNullerStats,
  type LogburnAction,
  type LogburnFetchResult,
} from '@/lib/fetchLeaderboard';

// Best coverage seen this session. Hyperion providers occasionally return a
// truncated index; never let a thinner answer replace a fuller one.
let bestSeen: { count: number; actions: LogburnAction[] } = { count: 0, actions: [] };

export function useNullerLeaderboard() {
  const query = useQuery<LogburnFetchResult>({
    queryKey: ['nuller-leaderboard'],
    queryFn: fetchLogburnActionsDetailed,
    staleTime: Infinity,
  });

  let actions = query.data?.actions ?? [];
  let isPartial = false;

  if (actions.length >= bestSeen.count) {
    if (actions.length > 0) bestSeen = { count: actions.length, actions };
  } else {
    // Truncated read — keep the fuller set we already had and flag it.
    actions = bestSeen.actions;
    isPartial = true;
  }

  if (query.data && query.data.endpointsSucceeded < 2) isPartial = true;

  const allStats = actions.length ? aggregateNullerStats(actions, 'cheese') : [];

  return {
    rawActions: actions,
    data: allStats,
    isLoading: query.isLoading,
    isError: query.isError,
    isPartial,
    refetch: query.refetch,
  };
}
