import { useQuery } from '@tanstack/react-query';
import { fetchContractVoteRewards } from '@/lib/cheeseRam';

/** Live vote-reward state for the CHEESERam contract account. */
export function useCheeseRamVoteRewards() {
  return useQuery({
    queryKey: ['cheeseRam', 'voteRewards'],
    queryFn: fetchContractVoteRewards,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
