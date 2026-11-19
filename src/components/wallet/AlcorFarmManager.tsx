import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, TrendingUp, Coins, Plus, RefreshCw, Zap, Wifi, Database, LogOut, Recycle } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useAlcorFarms, UnstakedIncentivesMap, UnstakedLPPosition } from '@/hooks/useAlcorFarms';
import { useAlcorTokenPrices } from '@/hooks/useAlcorTokenPrices';
import { useWaxPrice } from '@/hooks/useWaxPrice';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { buildClaimRewardsAction, buildUnstakeAction, buildStakeAction, AlcorFarmPosition, UnstakedIncentive } from '@/lib/alcorFarms';
import { toast } from 'sonner';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { IncreaseLiquidityDialog } from './IncreaseLiquidityDialog';
import { CompoundAllDialog, CompoundPosition } from './CompoundAllDialog';
import { balanceKey, paysBothTokens } from '@/lib/alcorCompound';

import { CreateAlcorFarmDialog } from './CreateAlcorFarmDialog';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface AlcorFarmManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

import { getIncentiveKey, isIncentiveExpired } from '@/lib/alcor/time';
import type { GroupedFarmPosition } from './alcor/types';
import { StakedFarmCard } from './alcor/StakedFarmCard';
import { UnstakedLPCard } from './alcor/UnstakedLPCard';


export function AlcorFarmManager({ onTransactionComplete, onTransactionSuccess }: AlcorFarmManagerProps) {
  const { session, accountName } = useWax();
  const { stakedFarms, unstakedIncentives, unstakedPositions, isLoading, refetch, dataSource } = useAlcorFarms();
  useAllTokenBalances(accountName);
  const { data: tokenPrices } = useAlcorTokenPrices();
  const { data: waxUsdPrice = 0 } = useWaxPrice();
  const [isTransacting, setIsTransacting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedPosition, setExpandedPosition] = useState<number | null>(null);
  const [liveRewards, setLiveRewards] = useState<Map<string, number>>(new Map());
  const [increaseLiquidityPosition, setIncreaseLiquidityPosition] = useState<AlcorFarmPosition | null>(null);
  const [createFarmOpen, setCreateFarmOpen] = useState(false);
  const [optimisticallyRemovedIds, setOptimisticallyRemovedIds] = useState<Set<string>>(new Set());
  const [compoundOpen, setCompoundOpen] = useState(false);


  const farmsList = Array.isArray(stakedFarms) ? stakedFarms : [];
  const unstakedList = Array.isArray(unstakedPositions) ? unstakedPositions : [];

  const getTokenUsdValue = useCallback((contract: string, symbol: string, amount: number): number => {
    if (symbol === 'WAX' && (contract === 'eosio.token' || !contract)) return amount * waxUsdPrice;
    if (tokenPrices) {
      if (contract) {
        const key = `${contract}:${symbol}`;
        const priceInWax = tokenPrices.get(key);
        if (priceInWax) return amount * priceInWax * waxUsdPrice;
      }
      for (const [key, priceInWax] of tokenPrices) {
        if (key.endsWith(`:${symbol}`)) return amount * priceInWax * waxUsdPrice;
      }
    }
    return 0;
  }, [tokenPrices, waxUsdPrice]);

  const groupedPositions = useMemo(() => {
    const groups = new Map<number, GroupedFarmPosition>();
    const filteredFarms = farmsList.filter(farm => {
      const key = `${farm.positionId}-${farm.incentiveId}`;
      return !optimisticallyRemovedIds.has(key);
    });

    filteredFarms.forEach(farm => {
      if (!groups.has(farm.positionId)) {
        const tokenAValue = getTokenUsdValue(farm.tokenA.contract, farm.tokenA.symbol, farm.tokenA.amount);
        const tokenBValue = getTokenUsdValue(farm.tokenB.contract, farm.tokenB.symbol, farm.tokenB.amount);
        const positionUnstaked = unstakedIncentives.get(farm.positionId) || [];

        groups.set(farm.positionId, {
          positionId: farm.positionId,
          poolId: farm.poolId,
          tokenA: farm.tokenA,
          tokenB: farm.tokenB,
          tickLower: farm.tickLower,
          tickUpper: farm.tickUpper,
          isInRange: farm.isInRange,
          incentives: [],
          unstakedIncentives: positionUnstaked,
          usdValue: tokenAValue + tokenBValue,
        });
      }
      groups.get(farm.positionId)!.incentives.push(farm);
    });

    return groups;
  }, [farmsList, unstakedIncentives, getTokenUsdValue, optimisticallyRemovedIds]);

  const allPositionsSorted = useMemo(() => {
    type UnifiedPosition =
      | { type: 'staked'; data: GroupedFarmPosition; usdValue: number }
      | { type: 'unstaked'; data: UnstakedLPPosition; usdValue: number };

    const unified: UnifiedPosition[] = [];

    groupedPositions.forEach((pos) => {
      unified.push({ type: 'staked', data: pos, usdValue: pos.usdValue });
    });

    unstakedList.forEach((pos) => {
      const tokenAValue = getTokenUsdValue(pos.tokenA.contract, pos.tokenA.symbol, pos.tokenA.amount);
      const tokenBValue = getTokenUsdValue(pos.tokenB.contract, pos.tokenB.symbol, pos.tokenB.amount);
      unified.push({ type: 'unstaked', data: pos, usdValue: tokenAValue + tokenBValue });
    });

    unified.sort((a, b) => b.usdValue - a.usdValue);
    return unified;
  }, [groupedPositions, unstakedList, getTokenUsdValue]);

  const allExpiredIncentives = useMemo(() => {
    const expired: AlcorFarmPosition[] = [];
    groupedPositions.forEach((position) => {
      position.incentives.forEach((incentive) => {
        if (isIncentiveExpired(incentive.incentiveEndsAt)) expired.push(incentive);
      });
    });
    return expired;
  }, [groupedPositions]);

  // Count all stakeable opportunities: fully unstaked positions + staked positions with new incentives
  const totalStakeableCount = useMemo(() => {
    let count = unstakedList.length;
    groupedPositions.forEach((pos) => {
      if (pos.unstakedIncentives.length > 0) count++;
    });
    return count;
  }, [unstakedList, groupedPositions]);

  const toggleExpanded = useCallback((positionId: number) => {
    setExpandedPosition((current) => (current === positionId ? null : positionId));
  }, []);

  const totalRewardsByToken = useMemo(() => {
    const totals = new Map<string, { symbol: string; precision: number; total: number }>();
    farmsList.forEach(farm => {
      const key = getIncentiveKey(farm);
      const liveReward = liveRewards.get(key) || farm.pendingReward;
      const existing = totals.get(farm.rewardToken.symbol);
      if (existing) {
        existing.total += liveReward;
      } else {
        totals.set(farm.rewardToken.symbol, { symbol: farm.rewardToken.symbol, precision: farm.rewardToken.precision, total: liveReward });
      }
    });
    return Array.from(totals.values()).sort((a, b) => b.total - a.total);
  }, [farmsList, liveRewards]);

  // Positions that can feed the Compound All flow: staked positions whose farms
  // pay out both tokens of their own pool.
  const compoundPositions = useMemo<CompoundPosition[]>(() => {
    const list: CompoundPosition[] = [];
    groupedPositions.forEach((pos) => {
      if (pos.incentives.length === 0) return;
      list.push({
        positionId: pos.positionId,
        poolId: pos.poolId,
        tickLower: pos.tickLower,
        tickUpper: pos.tickUpper,
        tokenA: pos.tokenA,
        tokenB: pos.tokenB,
        usdValue: pos.usdValue,
        incentives: pos.incentives,
      });
    });
    return list;
  }, [groupedPositions]);

  const compoundableCount = useMemo(() => {
    return compoundPositions.filter((pos) =>
      paysBothTokens(
        pos.incentives.map(i => balanceKey(i.rewardToken.contract, i.rewardToken.symbol)),
        pos.tokenA,
        pos.tokenB,
      ),
    ).length;
  }, [compoundPositions]);



  useEffect(() => {
    if (farmsList.length === 0) return;
    const updateRewards = () => {
      const now = Math.floor(Date.now() / 1000);
      const newRewards = new Map<string, number>();
      farmsList.forEach(farm => {
        const key = getIncentiveKey(farm);
        const elapsedSeconds = Math.max(0, now - farm.lastUpdate);
        newRewards.set(key, farm.pendingReward + (farm.rewardPerSecond * elapsedSeconds));
      });
      setLiveRewards(newRewards);
    };
    updateRewards();
    const interval = setInterval(updateRewards, 1000);
    return () => clearInterval(interval);
  }, [farmsList]);

  const handleClaimRewards = useCallback(async (claims: Array<{ incentiveId: number; posId: number }>) => {
    if (!session || !accountName || claims.length === 0) return;
    setIsTransacting(true);
    try {
      const actions = buildClaimRewardsAction(accountName, claims);
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.('Rewards Claimed!', `Claimed rewards from ${claims.length} incentive(s)`, txId);
      refetch();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Claim error:', error);
      toast.error(error?.message || 'Failed to claim rewards');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, onTransactionSuccess, refetch, onTransactionComplete]);

  const handleClaimAll = useCallback(async () => {
    if (!session || !accountName || farmsList.length === 0) return;
    setIsTransacting(true);
    try {
      const claimsMap = new Map<string, { incentiveId: number; posId: number }>();
      farmsList.forEach(f => {
        const key = `${f.incentiveId}-${f.positionId}`;
        if (!claimsMap.has(key)) claimsMap.set(key, { incentiveId: f.incentiveId, posId: f.positionId });
      });
      const claims = Array.from(claimsMap.values());
      const actions = buildClaimRewardsAction(accountName, claims);
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.('All Rewards Claimed!', `Claimed rewards from ${claims.length} incentive(s)`, txId);
      refetch();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Claim all error:', error);
      toast.error(error?.message || 'Failed to claim all rewards');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, farmsList, onTransactionSuccess, refetch, onTransactionComplete]);

  const handleUnstake = useCallback(async (incentives: AlcorFarmPosition[]) => {
    if (!session || !accountName || incentives.length === 0) return;
    setIsTransacting(true);
    try {
      const actions = incentives.map(incentive =>
        buildUnstakeAction(accountName, incentive.incentiveId, incentive.positionId)
      );
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      const removedIds = new Set(incentives.map(i => `${i.positionId}-${i.incentiveId}`));
      setOptimisticallyRemovedIds(prev => new Set([...prev, ...removedIds]));
      const firstIncentive = incentives[0];
      onTransactionSuccess?.('Unstaked & Claimed!', `Claimed rewards and removed ${firstIncentive.tokenA.symbol}/${firstIncentive.tokenB.symbol} position from ${incentives.length} farm(s). Your LP tokens are still in the pool.`, txId);
      setTimeout(() => { refetch(); setOptimisticallyRemovedIds(new Set()); }, 3000);
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Unstake error:', error);
      toast.error(error?.message || 'Failed to unstake position');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, onTransactionSuccess, refetch, onTransactionComplete]);

  const handleUnstakeSingle = useCallback(async (incentive: AlcorFarmPosition) => {
    await handleUnstake([incentive]);
  }, [handleUnstake]);

  const handleStakeToIncentive = useCallback(async (positionId: number, incentive: UnstakedIncentive) => {
    if (!session || !accountName) return;
    setIsTransacting(true);
    try {
      const action = buildStakeAction(accountName, incentive.incentiveId, positionId);
      const result = await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.('Position Staked!', `Staked position #${positionId} to ${incentive.rewardToken.symbol} farm rewards`, txId);
      refetch();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Stake error:', error);
      toast.error(error?.message || 'Failed to stake position');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, onTransactionSuccess, refetch, onTransactionComplete]);

  const handleStakeAllIncentives = useCallback(async (positionId: number, incentives: UnstakedIncentive[]) => {
    if (!session || !accountName || incentives.length === 0) return;
    setIsTransacting(true);
    try {
      const actions = incentives.map(incentive => buildStakeAction(accountName, incentive.incentiveId, positionId));
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      const rewardSymbols = incentives.map(i => i.rewardToken.symbol).join(', ');
      onTransactionSuccess?.('Position Staked!', `Staked position #${positionId} to ${incentives.length} farm rewards (${rewardSymbols})`, txId);
      refetch();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Stake all error:', error);
      toast.error(error?.message || 'Failed to stake position');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, onTransactionSuccess, refetch, onTransactionComplete]);

  const handleStakeAllUnstakedPositions = useCallback(async () => {
    if (!session || !accountName) return;
    setIsTransacting(true);
    try {
      const actions: any[] = [];

      // Fully unstaked LP positions
      unstakedList.forEach(pos => {
        pos.availableIncentives.forEach(incentive => {
          actions.push(buildStakeAction(accountName, incentive.incentiveId, pos.positionId));
        });
      });

      // Staked positions with new unstaked incentives
      groupedPositions.forEach(pos => {
        pos.unstakedIncentives.forEach(incentive => {
          actions.push(buildStakeAction(accountName, incentive.incentiveId, pos.positionId));
        });
      });

      if (actions.length === 0) {
        toast.error('No stakeable incentives found');
        return;
      }
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      onTransactionSuccess?.('All Positions Staked!', `Staked ${totalStakeableCount} position(s) into ${actions.length} farm incentive(s)`, txId);
      refetch();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Stake all positions error:', error);
      toast.error(error?.message || 'Failed to stake all positions');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, unstakedList, groupedPositions, totalStakeableCount, onTransactionSuccess, refetch, onTransactionComplete]);

  const handleClaimUnstakeAllExpired = useCallback(async (expiredIncentives: AlcorFarmPosition[]) => {
    if (!session || !accountName || expiredIncentives.length === 0) return;
    setIsTransacting(true);
    try {
      const actions = expiredIncentives.map(incentive =>
        buildUnstakeAction(accountName, incentive.incentiveId, incentive.positionId)
      );
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;
      const removedIds = new Set(expiredIncentives.map(i => `${i.positionId}-${i.incentiveId}`));
      setOptimisticallyRemovedIds(prev => new Set([...prev, ...removedIds]));
      onTransactionSuccess?.('Ended Farms Cleaned Up!', `Claimed rewards and unstaked from ${expiredIncentives.length} ended farm(s). Active farms were not affected.`, txId);
      setTimeout(() => { refetch(); setOptimisticallyRemovedIds(new Set()); }, 3000);
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Unstake all expired error:', error);
      toast.error(error?.message || 'Failed to unstake expired farms');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, onTransactionSuccess, refetch, onTransactionComplete]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-cheese" />
        <span className="text-muted-foreground">Loading farm positions...</span>
      </div>
    );
  }

  const totalPositionsWithFarms = allPositionsSorted.length;
  const totalEarningRewards = farmsList.length;

  if (farmsList.length === 0 && unstakedList.length === 0) {
    return (
      <>
        <div className="text-center py-12 space-y-4">
          <div className="text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>You have no LP positions with available farm rewards</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" className="gap-2" onClick={() => window.open('https://wax.alcor.exchange/farm', '_blank')}>
              <ExternalLink className="h-4 w-4" />
              Explore Alcor Farms
            </Button>
            <Button variant="default" className="gap-2 bg-cheese hover:bg-cheese/90 text-cheese-foreground" onClick={() => setCreateFarmOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Farm
            </Button>
          </div>
        </div>
        <CreateAlcorFarmDialog open={createFarmOpen} onOpenChange={setCreateFarmOpen} onTransactionSuccess={onTransactionSuccess} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-sm font-medium">Your Farm Positions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalPositionsWithFarms} position{totalPositionsWithFarms !== 1 ? 's' : ''} with farms
              {totalEarningRewards > 0 && ` • ${totalEarningRewards} earning`}
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {dataSource === 'api' ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs h-5">
                    <Wifi className="h-3 w-3 mr-1" />API
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs h-5">
                    <Database className="h-3 w-3 mr-1" />On-Chain
                  </Badge>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {dataSource === 'api' ? 'Connected to Alcor API' : 'Using blockchain fallback (Alcor API unavailable)'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button size="sm" variant="outline" onClick={() => setCreateFarmOpen(true)} className="h-6 px-2 text-xs gap-1 border-cheese/50 text-cheese hover:bg-cheese/10">
            <Plus className="h-3 w-3" />Create Farm
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {allExpiredIncentives.length > 0 && (
            <Button size="sm" onClick={() => handleClaimUnstakeAllExpired(allExpiredIncentives)} disabled={isTransacting} className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
              {isTransacting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><LogOut className="h-3.5 w-3.5" />Claim & Unstake Ended ({allExpiredIncentives.length})</>}
            </Button>
          )}
          {totalStakeableCount > 0 && (
            <Button size="sm" onClick={handleStakeAllUnstakedPositions} disabled={isTransacting} className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white gap-1.5">
              {isTransacting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Zap className="h-3.5 w-3.5" />Stake All Positions ({totalStakeableCount})</>}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => { setIsRefreshing(true); refetch(); setTimeout(() => setIsRefreshing(false), 1000); }} disabled={isTransacting || isRefreshing} className="h-8 w-8 p-0">
            <RefreshCw className={cn("h-4 w-4 transition-transform", isRefreshing && "animate-spin")} />
          </Button>
          {compoundPositions.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" onClick={() => setCompoundOpen(true)} disabled={isTransacting} className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                    <Recycle className="h-3.5 w-3.5" />Compound All ({compoundableCount})
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-center max-w-[220px]">
                  <p className="text-xs">Claim your rewards, then add them straight back into the same pools. Pools whose rewards only cover one token are skipped.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={handleClaimAll} disabled={isTransacting} className="bg-cheese hover:bg-cheese-dark text-primary-foreground">
                  {isTransacting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Coins className="h-4 w-4 mr-1" />Claim All</>}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Claimable</p>
                <div className="font-mono text-sm space-y-0.5">
                  {totalRewardsByToken.length > 0 ? (
                    totalRewardsByToken.map(({ symbol, precision, total }) => (
                      <div key={symbol} className="text-cheese">{total.toFixed(Math.min(4, precision))} {symbol}</div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No rewards</div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Farm position cards */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-4">
        {allPositionsSorted.map((item) =>
          item.type === 'staked' ? (
            <StakedFarmCard
              key={item.data.positionId}
              position={item.data}
              isExpanded={expandedPosition === item.data.positionId}
              isTransacting={isTransacting}
              liveRewards={liveRewards}
              getTokenUsdValue={getTokenUsdValue}
              onToggleExpand={toggleExpanded}
              onIncreaseLiquidity={setIncreaseLiquidityPosition}
              handleClaimRewards={handleClaimRewards}
              handleUnstake={handleUnstake}
              handleUnstakeSingle={handleUnstakeSingle}
              handleStakeToIncentive={handleStakeToIncentive}
              handleStakeAllIncentives={handleStakeAllIncentives}
            />
          ) : (
            <UnstakedLPCard
              key={`unstaked-${item.data.positionId}`}
              position={item.data}
              usdValue={item.usdValue}
              isExpanded={expandedPosition === item.data.positionId}
              isTransacting={isTransacting}
              onToggleExpand={toggleExpanded}
              handleStakeToIncentive={handleStakeToIncentive}
              handleStakeAllIncentives={handleStakeAllIncentives}
            />
          )
        )}
      </div>

      <IncreaseLiquidityDialog
        open={!!increaseLiquidityPosition}
        onOpenChange={(open) => !open && setIncreaseLiquidityPosition(null)}
        position={increaseLiquidityPosition}
        onSuccess={(title, description, txId) => {
          setIncreaseLiquidityPosition(null);
          onTransactionSuccess?.(title, description, txId);
          setTimeout(() => { refetch(); }, 3000);
          onTransactionComplete?.();
        }}
      />

      <CreateAlcorFarmDialog
        open={createFarmOpen}
        onOpenChange={setCreateFarmOpen}
        onTransactionSuccess={(title, description, txId) => {
          onTransactionSuccess?.(title, description, txId);
          setTimeout(() => refetch(), 3000);
        }}
        onTransactionComplete={onTransactionComplete}
      />

      <CompoundAllDialog
        open={compoundOpen}
        onOpenChange={setCompoundOpen}
        positions={compoundPositions}
        onTransactionSuccess={(title, description, txId) => {
          onTransactionSuccess?.(title, description, txId);
          setTimeout(() => refetch(), 3000);
        }}
        onTransactionComplete={onTransactionComplete}
      />

    </div>
  );
}
