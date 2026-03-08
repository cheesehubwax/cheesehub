import { useQuery } from '@tanstack/react-query';
import { fetchContractStats, fetchCpowerStats, parseAssetAmount } from '@/lib/cheeseNullApi';

const CONTRACT_ACCOUNT = 'cheeseburner';

export interface CheeseNullStatsData {
  totalBurns: number;
  totalCheeseNulled: number;
  totalCheeseLiquidity: number;
  totalWaxCompounded: number;
  totalWaxCheesepowerz: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useCheeseNullStats(): CheeseNullStatsData {
  const statsQuery = useQuery({
    queryKey: ['cheeseNull', 'contractStats', CONTRACT_ACCOUNT],
    queryFn: () => fetchContractStats(CONTRACT_ACCOUNT),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const cpowerQuery = useQuery({
    queryKey: ['cheeseNull', 'cpowerStats', CONTRACT_ACCOUNT],
    queryFn: () => fetchCpowerStats(CONTRACT_ACCOUNT),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const refetch = () => {
    statsQuery.refetch();
    cpowerQuery.refetch();
  };

  return {
    totalBurns: statsQuery.data?.total_burns ?? 0,
    totalCheeseNulled: parseAssetAmount(statsQuery.data?.total_cheese_burned ?? ''),
    totalCheeseLiquidity: parseAssetAmount(statsQuery.data?.total_cheese_liquidity ?? ''),
    totalWaxCompounded: parseAssetAmount(statsQuery.data?.total_wax_staked ?? ''),
    totalWaxCheesepowerz: parseAssetAmount(cpowerQuery.data?.total_wax_cheesepowerz ?? ''),
    isLoading: statsQuery.isLoading || cpowerQuery.isLoading,
    isError: statsQuery.isError || cpowerQuery.isError,
    refetch,
  };
}
