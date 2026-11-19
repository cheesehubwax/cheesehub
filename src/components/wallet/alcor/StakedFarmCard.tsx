import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingUp, Percent, Coins, ChevronDown, ChevronUp, Plus, Zap, Clock, LogOut } from 'lucide-react';
import { TokenLogo } from '@/components/TokenLogo';
import { cn } from '@/lib/utils';
import type { AlcorFarmPosition, UnstakedIncentive } from '@/lib/alcorFarms';
import { formatDetailedCountdown, formatRemainingDays, getIncentiveKey, isIncentiveExpired } from '@/lib/alcor/time';
import type { GroupedFarmPosition } from './types';

interface StakedFarmCardProps {
  position: GroupedFarmPosition;
  isExpanded: boolean;
  isTransacting: boolean;
  liveRewards: Map<string, number>;
  getTokenUsdValue: (contract: string, symbol: string, amount: number) => number;
  onToggleExpand: (positionId: number) => void;
  onIncreaseLiquidity: (position: AlcorFarmPosition) => void;
  handleClaimRewards: (claims: Array<{ incentiveId: number; posId: number }>) => void;
  handleUnstake: (incentives: AlcorFarmPosition[]) => void;
  handleUnstakeSingle: (incentive: AlcorFarmPosition) => void;
  handleStakeToIncentive: (positionId: number, incentive: UnstakedIncentive) => void;
  handleStakeAllIncentives: (positionId: number, incentives: UnstakedIncentive[]) => void;
}

/** One staked LP position with its farm incentives. */
export const StakedFarmCard = memo(function StakedFarmCard({
  position, isExpanded, isTransacting, liveRewards, getTokenUsdValue, onToggleExpand, onIncreaseLiquidity,
  handleClaimRewards, handleUnstake, handleUnstakeSingle, handleStakeToIncentive, handleStakeAllIncentives,
}: StakedFarmCardProps) {
  const positionClaims = position.incentives.map(i => ({ incentiveId: i.incentiveId, posId: i.positionId }));
  const allIncentivesExpired = position.incentives.every(i => isIncentiveExpired(i.incentiveEndsAt));

  return (
    <Card className={cn("border-border/50", allIncentivesExpired ? "bg-amber-500/5 border-l-4 border-l-amber-500/70" : "bg-muted/30")}>
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

          <div className="w-[70px] shrink-0 text-center" title="Live estimate derived from current pool reward rate and TVL. Not a promised return.">
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1"><Percent className="h-3 w-3" />Est.</div>
            <div className="space-y-0.5">
              {position.incentives.map((incentive) => {
                const key = getIncentiveKey(incentive);
                const dailyValueUsd = getTokenUsdValue(incentive.rewardToken.contract, incentive.rewardToken.symbol, incentive.dailyEarnRate);
                const apr = position.usdValue > 0 ? (dailyValueUsd * 365 / position.usdValue) * 100 : 0;
                return <div key={key} className="font-mono text-xs text-green-400">{apr > 0 ? `${apr.toFixed(1)}%` : '—'}</div>;
              })}
            </div>
            <div className="text-[9px] text-muted-foreground/70 mt-1 leading-tight">estimate only</div>
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
            <Button size="sm" variant="ghost" onClick={() => onToggleExpand(position.positionId)} className="h-8 w-8 p-0">
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
              <Button size="sm" onClick={() => { const baseIncentive = position.incentives[0]; if (baseIncentive) onIncreaseLiquidity({ ...baseIncentive, tickLower: position.tickLower, tickUpper: position.tickUpper }); }} disabled={isTransacting || (position.tickLower === 0 && position.tickUpper === 0)} className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white">
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
});
