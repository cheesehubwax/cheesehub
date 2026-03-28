import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, TrendingUp, Percent, Coins, ChevronDown, ChevronUp, Plus, RefreshCw, Zap, Wifi, Database, Clock, LogOut } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useAlcorFarms, UnstakedIncentivesMap, UnstakedLPPosition } from '@/hooks/useAlcorFarms';
import { useAlcorTokenPrices } from '@/hooks/useAlcorTokenPrices';
import { useWaxPrice } from '@/hooks/useWaxPrice';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { buildClaimRewardsAction, buildUnstakeAction, buildStakeAction, AlcorFarmPosition, UnstakedIncentive } from '@/lib/alcorFarms';
import { TokenLogo } from '@/components/TokenLogo';
import { toast } from 'sonner';
import { closeWharfkitModals } from '@/lib/wharfKit';
import { IncreaseLiquidityDialog } from './IncreaseLiquidityDialog';
import { CreateAlcorFarmDialog } from './CreateAlcorFarmDialog';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface AlcorFarmManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

interface GroupedFarmPosition {
  positionId: number;
  poolId: number;
  tokenA: { contract: string; symbol: string; amount: number };
  tokenB: { contract: string; symbol: string; amount: number };
  tickLower: number;
  tickUpper: number;
  isInRange: boolean;
  incentives: AlcorFarmPosition[];
  unstakedIncentives: UnstakedIncentive[];
  usdValue: number;
}

function isIncentiveExpired(endTimestamp: number): boolean {
  if (endTimestamp <= 0) return false;
  return endTimestamp <= Math.floor(Date.now() / 1000);
}

function formatRemainingDays(endTimestamp: number): { label: string; isUrgent: boolean; isExpired: boolean } {
  const now = Math.floor(Date.now() / 1000);
  if (endTimestamp <= 0) return { label: '—', isUrgent: false, isExpired: false };
  if (endTimestamp <= now) return { label: 'Ended', isUrgent: false, isExpired: true };

  const secondsLeft = endTimestamp - now;
  const daysLeft = Math.floor(secondsLeft / 86400);
  const hoursLeft = Math.floor((secondsLeft % 86400) / 3600);

  if (daysLeft > 7) return { label: `${daysLeft}d`, isUrgent: false, isExpired: false };
  if (daysLeft > 0) return { label: `${daysLeft}d ${hoursLeft}h`, isUrgent: true, isExpired: false };
  return { label: `${hoursLeft}h`, isUrgent: true, isExpired: false };
}

function formatDetailedCountdown(endTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  if (endTimestamp <= 0) return 'Unknown end time';
  if (endTimestamp <= now) return 'Farm has ended';

  const secondsLeft = endTimestamp - now;
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);

  const endDate = new Date(endTimestamp * 1000);
  const dateStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (days > 0) return `${days}d ${hours}h ${minutes}m (${dateStr} ${timeStr})`;
  if (hours > 0) return `${hours}h ${minutes}m (${dateStr} ${timeStr})`;
  return `${minutes}m (${dateStr} ${timeStr})`;
}

export function AlcorFarmManager({ onTransactionComplete, onTransactionSuccess }: AlcorFarmManagerProps) {
  const { session, accountName } = useWax();
  const { stakedFarms, unstakedIncentives, unstakedPositions, isLoading, refetch, dataSource } = useAlcorFarms();
  const { refetch: refetchTokenBalances } = useAllTokenBalances(accountName);
  const { data: tokenPrices } = useAlcorTokenPrices();
  const { data: waxUsdPrice = 0 } = useWaxPrice();
  const [isTransacting, setIsTransacting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedPosition, setExpandedPosition] = useState<number | null>(null);
  const [liveRewards, setLiveRewards] = useState<Map<string, number>>(new Map());
  const [increaseLiquidityPosition, setIncreaseLiquidityPosition] = useState<AlcorFarmPosition | null>(null);
  const [createFarmOpen, setCreateFarmOpen] = useState(false);
  const [optimisticallyRemovedIds, setOptimisticallyRemovedIds] = useState<Set<string>>(new Set());

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

  const getIncentiveKey = (farm: AlcorFarmPosition) => `${farm.positionId}-${farm.incentiveId}`;

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
      const result = await session.transact({ actions });
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
  }, [session, accountName, onTransactionSuccess, refetch, refetchTokenBalances, onTransactionComplete]);

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
      const result = await session.transact({ actions });
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
  }, [session, accountName, farmsList, onTransactionSuccess, refetch, refetchTokenBalances, onTransactionComplete]);

  const handleUnstake = useCallback(async (incentives: AlcorFarmPosition[]) => {
    if (!session || !accountName || incentives.length === 0) return;
    setIsTransacting(true);
    try {
      const actions = incentives.map(incentive =>
        buildUnstakeAction(accountName, incentive.incentiveId, incentive.positionId)
      );
      const result = await session.transact({ actions });
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
      const result = await session.transact({ actions: [action] });
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
      const result = await session.transact({ actions });
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

  const handleClaimUnstakeAllExpired = useCallback(async (expiredIncentives: AlcorFarmPosition[]) => {
    if (!session || !accountName || expiredIncentives.length === 0) return;
    setIsTransacting(true);
    try {
      const actions = expiredIncentives.map(incentive =>
        buildUnstakeAction(accountName, incentive.incentiveId, incentive.positionId)
      );
      const result = await session.transact({ actions });
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
        <div className="flex items-center gap-2">
          {allExpiredIncentives.length > 0 && (
            <Button size="sm" onClick={() => handleClaimUnstakeAllExpired(allExpiredIncentives)} disabled={isTransacting} className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
              {isTransacting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><LogOut className="h-3.5 w-3.5" />Claim & Unstake Ended ({allExpiredIncentives.length})</>}
            </Button>
          )}
          {unstakedList.length > 0 && (
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-xs animate-pulse">
              <Zap className="h-3 w-3 mr-1" />{unstakedList.length} unstaked
            </Badge>
          )}
          <Button size="sm" variant="ghost" onClick={() => { setIsRefreshing(true); refetch(); setTimeout(() => setIsRefreshing(false), 1000); }} disabled={isTransacting || isRefreshing} className="h-8 w-8 p-0">
            <RefreshCw className={cn("h-4 w-4 transition-transform", isRefreshing && "animate-spin")} />
          </Button>
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
        {allPositionsSorted.map((item) => {
          if (item.type === 'staked') {
            const position = item.data;
            const isExpanded = expandedPosition === position.positionId;
            const positionClaims = position.incentives.map(i => ({ incentiveId: i.incentiveId, posId: i.positionId }));
            const allIncentivesExpired = position.incentives.every(i => isIncentiveExpired(i.incentiveEndsAt));

            return (
              <Card key={position.positionId} className={cn("border-border/50", allIncentivesExpired ? "bg-amber-500/5 border-l-4 border-l-amber-500/70" : "bg-muted/30")}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        <TokenLogo contract={position.tokenA.contract} symbol={position.tokenA.symbol} size="sm" />
                        <TokenLogo contract={position.tokenB.contract} symbol={position.tokenB.symbol} size="sm" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{position.tokenA.symbol}/{position.tokenB.symbol}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Pool #{position.positionId}
                          {position.usdValue > 0 && <span className="text-cheese ml-1">${position.usdValue.toFixed(2)}</span>}
                        </div>
                      </div>
                    </div>
                    {position.unstakedIncentives.length > 0 && (
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); position.unstakedIncentives.length === 1 ? handleStakeToIncentive(position.positionId, position.unstakedIncentives[0]) : handleStakeAllIncentives(position.positionId, position.unstakedIncentives); }} disabled={isTransacting} className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white animate-pulse">
                        <Zap className="h-3 w-3 mr-1" />{position.unstakedIncentives.length === 1 ? 'Stake' : `Stake (${position.unstakedIncentives.length})`}
                      </Button>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="w-[140px] shrink-0">
                      <div className="text-xs text-muted-foreground mb-1">Stake</div>
                      <div className="font-mono text-xs space-y-0.5 text-foreground">
                        <div>{position.tokenA.amount.toFixed(4)} {position.tokenA.symbol}</div>
                        <div>{position.tokenB.amount.toFixed(4)} {position.tokenB.symbol}</div>
                      </div>
                    </div>

                    <div className="w-[60px] shrink-0 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1"><Percent className="h-3 w-3" />APR</div>
                      <div className="space-y-0.5">
                        {position.incentives.map((incentive) => {
                          const key = getIncentiveKey(incentive);
                          const dailyValueUsd = getTokenUsdValue(incentive.rewardToken.contract, incentive.rewardToken.symbol, incentive.dailyEarnRate);
                          const apr = position.usdValue > 0 ? (dailyValueUsd * 365 / position.usdValue) * 100 : 0;
                          return <div key={key} className="font-mono text-xs text-green-400">{apr > 0 ? `${apr.toFixed(1)}%` : '—'}</div>;
                        })}
                      </div>
                    </div>

                    <div className="w-[120px] shrink-0 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1"><TrendingUp className="h-3 w-3" />Daily</div>
                      <div className="space-y-0.5">
                        {position.incentives.map((incentive) => {
                          const key = getIncentiveKey(incentive);
                          return <div key={key} className="font-mono text-xs">{incentive.dailyEarnRate.toFixed(Math.min(4, incentive.rewardToken.precision))} {incentive.rewardToken.symbol}</div>;
                        })}
                      </div>
                    </div>

                    <div className="w-[70px] shrink-0 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1"><Clock className="h-3 w-3" />Remaining</div>
                      <div className="space-y-0.5">
                        {position.incentives.map((incentive) => {
                          const key = getIncentiveKey(incentive);
                          const { label, isUrgent, isExpired } = formatRemainingDays(incentive.incentiveEndsAt);
                          return <div key={key} className={cn("font-mono text-xs", isExpired ? "text-amber-500" : isUrgent ? "text-red-400" : "text-muted-foreground")}>{label}</div>;
                        })}
                      </div>
                    </div>

                    <div className="min-w-[100px]">
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Coins className="h-3 w-3" />Earned</div>
                      <div className="space-y-0.5">
                        {position.incentives.map((incentive) => {
                          const key = getIncentiveKey(incentive);
                          const liveReward = liveRewards.get(key) || incentive.pendingReward;
                          return <div key={key} className="font-mono text-xs text-cheese">{liveReward.toFixed(Math.min(4, incentive.rewardToken.precision))} {incentive.rewardToken.symbol}</div>;
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {allIncentivesExpired ? (
                        <Button size="sm" onClick={() => handleUnstake(position.incentives)} disabled={isTransacting} className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white">
                          <LogOut className="h-3 w-3 mr-1" />Claim & Unstake
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => handleClaimRewards(positionClaims)} disabled={isTransacting} className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white">
                          Claim
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setExpandedPosition(isExpanded ? null : position.positionId)} className="h-8 w-8 p-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <Badge variant={position.isInRange ? "default" : "secondary"} className={cn("text-xs", position.isInRange ? "bg-green-500/20 text-green-400 border-green-500/50" : "")}>
                          {position.isInRange ? 'In Range' : 'Out of Range'}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs text-muted-foreground font-medium">Reward Breakdown:</span>
                        <div className="grid gap-2">
                          {position.incentives.map((incentive) => {
                            const key = getIncentiveKey(incentive);
                            const liveReward = liveRewards.get(key) || incentive.pendingReward;
                            const detailedTime = formatDetailedCountdown(incentive.incentiveEndsAt);
                            const isExpiredInc = isIncentiveExpired(incentive.incentiveEndsAt);
                            return (
                              <div key={key} className={cn("flex items-center justify-between p-2 rounded text-sm", isExpiredInc ? "bg-amber-500/10 border border-amber-500/30" : "bg-background/50")}>
                                <div className="flex items-center gap-2">
                                  <TokenLogo contract={incentive.rewardToken.contract} symbol={incentive.rewardToken.symbol} size="sm" />
                                  <div>
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium">{incentive.rewardToken.symbol}</span>
                                      <span className="text-xs text-muted-foreground">#{incentive.incentiveId}</span>
                                      {isExpiredInc && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-500/20 text-amber-400 border-amber-500/50">ENDED</Badge>}
                                    </div>
                                    <div className={cn("text-xs mt-0.5 flex items-center gap-1", isExpiredInc ? "text-amber-500" : "text-muted-foreground")}>
                                      <Clock className="h-3 w-3" />{detailedTime}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="font-mono text-cheese">{liveReward.toFixed(incentive.rewardToken.precision)}</div>
                                    {!isExpiredInc && (
                                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" />{incentive.dailyEarnRate.toFixed(Math.min(4, incentive.rewardToken.precision))}/day
                                        <span className="ml-1"><Percent className="h-3 w-3 inline" />{incentive.rewardShare.toFixed(2)}%</span>
                                      </div>
                                    )}
                                  </div>
                                  {isExpiredInc && (
                                    <Button size="sm" onClick={() => handleUnstakeSingle(incentive)} disabled={isTransacting} variant="outline" className="h-7 px-2 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
                                      <LogOut className="h-3 w-3 mr-1" />Claim & Unstake
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {position.unstakedIncentives.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs text-muted-foreground font-medium">New Rewards Available:</span>
                          <div className="grid gap-2">
                            {position.unstakedIncentives.map((incentive) => (
                              <div key={incentive.incentiveId} className="flex items-center justify-between p-2 rounded bg-green-500/10 border border-green-500/30 text-sm">
                                <div className="flex items-center gap-2">
                                  <TokenLogo contract={incentive.rewardToken.contract} symbol={incentive.rewardToken.symbol} size="sm" />
                                  <span className="font-medium">{incentive.rewardToken.symbol}</span>
                                  <span className="text-xs text-muted-foreground">#{incentive.incentiveId}</span>
                                </div>
                                <Button size="sm" onClick={() => handleStakeToIncentive(position.positionId, incentive)} disabled={isTransacting} className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700">
                                  <Zap className="h-3 w-3 mr-1" />Stake Position
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => { const baseIncentive = position.incentives[0]; if (baseIncentive) setIncreaseLiquidityPosition({ ...baseIncentive, tickLower: position.tickLower, tickUpper: position.tickUpper }); }} disabled={isTransacting || (position.tickLower === 0 && position.tickUpper === 0)} className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white">
                          <Plus className="h-3 w-3" />Increase Position
                        </Button>
                        <Button size="sm" onClick={() => handleUnstake(position.incentives)} disabled={isTransacting} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                          Unstake from Farm
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => window.open(`https://wax.alcor.exchange/positions/${position.positionId}`, '_blank')} className="px-2">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      {position.tickLower === 0 && position.tickUpper === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Tick data unavailable. <a href={`https://wax.alcor.exchange/positions/${position.positionId}`} target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">Manage on Alcor</a>
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          } else {
            const position = item.data;
            const usdValue = item.usdValue;
            const isExpanded = expandedPosition === position.positionId;

            return (
              <Card key={`unstaked-${position.positionId}`} className="bg-muted/30 border-border/50 border-l-4 border-l-green-500/70">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 w-[130px] shrink-0">
                      <div className="flex -space-x-2">
                        <TokenLogo contract={position.tokenA.contract} symbol={position.tokenA.symbol} size="sm" />
                        <TokenLogo contract={position.tokenB.contract} symbol={position.tokenB.symbol} size="sm" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{position.tokenA.symbol}/{position.tokenB.symbol}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Pool #{position.positionId}
                          {usdValue > 0 && <span className="text-cheese ml-1">${usdValue.toFixed(2)}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="w-[120px] shrink-0">
                      <div className="text-xs text-muted-foreground mb-1">Stake</div>
                      <div className="font-mono text-xs space-y-0.5">
                        <div>{position.tokenA.amount.toFixed(4)} {position.tokenA.symbol}</div>
                        <div>{position.tokenB.amount.toFixed(4)} {position.tokenB.symbol}</div>
                      </div>
                    </div>

                    <div className="flex-1 text-center">
                      <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/50">Not Earning Rewards</Badge>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {position.availableIncentives.length} farm{position.availableIncentives.length !== 1 ? 's' : ''} available
                    </div>

                    <div className="flex items-center gap-2">
                      {position.availableIncentives.length === 1 ? (
                        <Button size="sm" onClick={() => handleStakeToIncentive(position.positionId, position.availableIncentives[0])} disabled={isTransacting} className="h-8 px-4 text-xs bg-green-600 hover:bg-green-700 text-white animate-pulse">
                          <Zap className="h-4 w-4 mr-1" />Stake Position
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => handleStakeAllIncentives(position.positionId, position.availableIncentives)} disabled={isTransacting} className="h-8 px-4 text-xs bg-green-600 hover:bg-green-700 text-white animate-pulse">
                          <Zap className="h-4 w-4 mr-1" />Stake All ({position.availableIncentives.length})
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setExpandedPosition(isExpanded ? null : position.positionId)} className="h-8 w-8 p-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Your LP Tokens:</span>
                          <div className="font-mono mt-1">
                            <div>{position.tokenA.amount.toFixed(4)} {position.tokenA.symbol}</div>
                            <div>{position.tokenB.amount.toFixed(4)} {position.tokenB.symbol}</div>
                          </div>
                        </div>
                        <Badge variant={position.isInRange ? "default" : "secondary"} className={cn("text-xs", position.isInRange ? "bg-green-500/20 text-green-400 border-green-500/50" : "")}>
                          {position.isInRange ? 'In Range' : 'Out of Range'}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs text-muted-foreground font-medium">Available Farms:</span>
                        <div className="grid gap-2">
                          {position.availableIncentives.map((incentive) => (
                            <div key={incentive.incentiveId} className="flex items-center justify-between p-2 rounded bg-background/50 text-sm">
                              <div className="flex items-center gap-2">
                                <TokenLogo contract={incentive.rewardToken.contract} symbol={incentive.rewardToken.symbol} size="sm" />
                                <span className="font-medium">{incentive.rewardToken.symbol}</span>
                                <span className="text-xs text-muted-foreground">#{incentive.incentiveId}</span>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => handleStakeToIncentive(position.positionId, incentive)} disabled={isTransacting} className="h-6 px-2 text-xs">
                                <Zap className="h-3 w-3 mr-1" />Stake
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="ghost" onClick={() => window.open(`https://wax.alcor.exchange/positions/${position.positionId}`, '_blank')} className="flex-1 gap-1">
                          <ExternalLink className="h-3 w-3" />Manage on Alcor
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          }
        })}
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
    </div>
  );
}
