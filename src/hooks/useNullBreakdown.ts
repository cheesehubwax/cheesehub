import { useQuery } from '@tanstack/react-query';
import { fetchNullBreakdown, type NullBreakdownResult } from '@/lib/cheeseNullBreakdown';

export function useNullBreakdown() {
  return useQuery<NullBreakdownResult>({
    queryKey: ['null-breakdown'],
    queryFn: fetchNullBreakdown,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: false, // only fetch when popover opens
  });
}
