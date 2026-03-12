import { useQuery } from '@tanstack/react-query';
import { fetchNullBreakdown, type NullBreakdownEntry } from '@/lib/cheeseNullBreakdown';

export function useNullBreakdown() {
  return useQuery<NullBreakdownEntry[]>({
    queryKey: ['null-breakdown'],
    queryFn: fetchNullBreakdown,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: false, // only fetch when popover opens
  });
}
