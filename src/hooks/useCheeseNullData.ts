import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import {
  fetchAlcorPoolPrice,
  fetchVoterInfo,
  fetchGlobalState,
  calculateCheesePerWax,
  calculateClaimableRewards,
  getTimeUntilNextClaim,
  canClaim as checkCanClaim,
} from '@/lib/cheeseNullApi';

const CHEESEBURNER_ACCOUNT = 'cheeseburner';
const ALCOR_POOL_ID = 1252;
const REFRESH_INTERVAL = 30000;

export interface CheeseNullData {
  claimableWax: number;
  estimatedCheese: number;
  cheeseBurnAmount: number;
  cheeseLiquidityAmount: number;
  waxStakeAmount: number;
  waxCheesepowerzAmount: number;
  cheesePerWax: number;
  canClaim: boolean;
  timeUntilNextClaim: number;
  lastClaimTime: string | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCheeseNullData(): CheeseNullData {
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<number>(0);

  const poolQuery = useQuery({
    queryKey: ['cheeseNull', 'alcorPool', ALCOR_POOL_ID],
    queryFn: () => fetchAlcorPoolPrice(ALCOR_POOL_ID),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

  const voterQuery = useQuery({
    queryKey: ['cheeseNull', 'voterInfo', CHEESEBURNER_ACCOUNT],
    queryFn: () => fetchVoterInfo(CHEESEBURNER_ACCOUNT),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

  const globalQuery = useQuery({
    queryKey: ['cheeseNull', 'globalState'],
    queryFn: () => fetchGlobalState(),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  });

  const lastClaimTime = voterQuery.data?.last_claim_time ?? null;

  useEffect(() => {
    if (!lastClaimTime) return;
    const updateTimer = () => setTimeUntilNextClaim(getTimeUntilNextClaim(lastClaimTime));
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lastClaimTime]);

  const claimableWax = useMemo(() => {
    if (!voterQuery.data || !globalQuery.data) return 0;
    return calculateClaimableRewards(voterQuery.data, globalQuery.data);
  }, [voterQuery.data, globalQuery.data]);

  const cheesePerWax = poolQuery.data ? calculateCheesePerWax(poolQuery.data) : 0;

  const waxStakeAmount = claimableWax * 0.20;
  const waxCheesepowerzAmount = claimableWax * 0.05;
  const waxToSwap = claimableWax * 0.75;
  const estimatedCheese = waxToSwap * cheesePerWax;

  const cheeseBurnAmount = estimatedCheese * 0.85;
  const cheeseLiquidityAmount = estimatedCheese * 0.15;

  const canClaim = lastClaimTime ? checkCanClaim(lastClaimTime) : false;

  const refetch = () => {
    poolQuery.refetch();
    voterQuery.refetch();
    globalQuery.refetch();
  };

  return {
    claimableWax,
    estimatedCheese,
    cheeseBurnAmount,
    cheeseLiquidityAmount,
    waxStakeAmount,
    waxCheesepowerzAmount,
    cheesePerWax,
    canClaim,
    timeUntilNextClaim,
    lastClaimTime,
    isLoading: poolQuery.isLoading || voterQuery.isLoading || globalQuery.isLoading,
    isError: poolQuery.isError || voterQuery.isError || globalQuery.isError,
    error: poolQuery.error || voterQuery.error || globalQuery.error,
    refetch,
  };
}
