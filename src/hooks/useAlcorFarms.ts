import { useState, useEffect, useCallback, useRef } from 'react';
import { useWax } from '@/context/WaxContext';
import {
  AlcorFarmPosition,
  AlcorApiPosition,
  UnstakedIncentive,
  fetchUserStakedFarmsWithDetails,
  fetchUnstakedIncentivesForPosition,
  getAlcorDataSource,
} from '@/lib/alcorFarms';

// Exported types used by AlcorFarmManager
export type UnstakedIncentivesMap = Map<number, UnstakedIncentive[]>;

export interface UnstakedLPPosition {
  positionId: number;
  poolId: number;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  isInRange: boolean;
  tokenA: { contract: string; symbol: string; amount: number };
  tokenB: { contract: string; symbol: string; amount: number };
  fee: number;
  availableIncentives: UnstakedIncentive[];
}

// Re-export for convenience
export type { AlcorFarmPosition, UnstakedIncentive };

function parseAsset(assetStr: string): { amount: number; symbol: string } {
  if (!assetStr) return { amount: 0, symbol: '' };
  const parts = assetStr.trim().split(' ');
  return { amount: parseFloat(parts[0]) || 0, symbol: parts[1] || '' };
}

export function useAlcorFarms() {
  const { accountName } = useWax();
  const [stakedFarms, setStakedFarms] = useState<AlcorFarmPosition[]>([]);
  const [unstakedIncentives, setUnstakedIncentives] = useState<UnstakedIncentivesMap>(new Map());
  const [unstakedPositions, setUnstakedPositions] = useState<UnstakedLPPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'api' | 'blockchain'>('api');
  const fetchIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!accountName) {
      setStakedFarms([]);
      setUnstakedIncentives(new Map());
      setUnstakedPositions([]);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const { farms, positions } = await fetchUserStakedFarmsWithDetails(accountName);
      if (fetchId !== fetchIdRef.current) return;

      setStakedFarms(farms);
      setDataSource(getAlcorDataSource());

      // Find staked position IDs and their incentive IDs
      const stakedPositionIncentives = new Map<number, number[]>();
      farms.forEach(farm => {
        const existing = stakedPositionIncentives.get(farm.positionId) || [];
        existing.push(farm.incentiveId);
        stakedPositionIncentives.set(farm.positionId, existing);
      });

      // Find unstaked positions (positions not in any farm)
      const stakedPositionIds = new Set(farms.map(f => f.positionId));
      const unstaked: UnstakedLPPosition[] = [];

      for (const pos of positions) {
        if (!stakedPositionIds.has(pos.id)) {
          const amountA = parseAsset(pos.amountA);
          const amountB = parseAsset(pos.amountB);
          unstaked.push({
            positionId: pos.id,
            poolId: pos.pool,
            liquidity: pos.liquidity,
            tickLower: pos.tickLower,
            tickUpper: pos.tickUpper,
            isInRange: pos.inRange,
            tokenA: { contract: '', symbol: amountA.symbol, amount: amountA.amount },
            tokenB: { contract: '', symbol: amountB.symbol, amount: amountB.amount },
            fee: 0,
            availableIncentives: [],
          });
        }
      }

      setUnstakedPositions(unstaked);

      // Fetch unstaked incentives for each position (staked ones that might have more incentives available)
      const incentivesMap = new Map<number, UnstakedIncentive[]>();

      const allPositionsToCheck = [
        ...Array.from(stakedPositionIncentives.entries()).map(([posId, incentiveIds]) => {
          const farm = farms.find(f => f.positionId === posId);
          return { posId, poolId: farm?.poolId || 0, stakedIds: incentiveIds };
        }),
        ...unstaked.map(pos => ({
          posId: pos.positionId,
          poolId: pos.poolId,
          stakedIds: [] as number[],
        })),
      ];

      await Promise.allSettled(
        allPositionsToCheck.map(async ({ posId, poolId, stakedIds }) => {
          if (poolId <= 0) return;
          try {
            const available = await fetchUnstakedIncentivesForPosition(posId, poolId, stakedIds);
            if (available.length > 0) {
              incentivesMap.set(posId, available);
            }
          } catch {
            // Silently skip
          }
        })
      );

      if (fetchId !== fetchIdRef.current) return;
      setUnstakedIncentives(incentivesMap);

      // Only keep unstaked positions that have available incentives (a farm exists for that pair)
      const enrichedUnstaked = unstaked
        .map(pos => ({
          ...pos,
          availableIncentives: incentivesMap.get(pos.positionId) || [],
        }))
        .filter(pos => pos.availableIncentives.length > 0);
      setUnstakedPositions(enrichedUnstaked);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load farm data');
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [accountName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    stakedFarms,
    unstakedIncentives,
    unstakedPositions,
    isLoading,
    error,
    refetch: fetchData,
    dataSource,
  };
}
