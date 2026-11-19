import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { TokenLogo } from '@/components/TokenLogo';
import { cn } from '@/lib/utils';
import type { UnstakedIncentive } from '@/lib/alcorFarms';
import type { UnstakedLPPosition } from '@/hooks/useAlcorFarms';

interface UnstakedLPCardProps {
  position: UnstakedLPPosition;
  usdValue: number;
  isExpanded: boolean;
  isTransacting: boolean;
  onToggleExpand: (positionId: number) => void;
  handleStakeToIncentive: (positionId: number, incentive: UnstakedIncentive) => void;
  handleStakeAllIncentives: (positionId: number, incentives: UnstakedIncentive[]) => void;
}

/** One LP position that has farms available but is not staked to any. */
export const UnstakedLPCard = memo(function UnstakedLPCard({
  position, usdValue, isExpanded, isTransacting, onToggleExpand, handleStakeToIncentive, handleStakeAllIncentives,
}: UnstakedLPCardProps) {
  return (
    <Card className="bg-muted/30 border-border/50 border-l-4 border-l-green-500/70">
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
            <Button size="sm" variant="ghost" onClick={() => onToggleExpand(position.positionId)} className="h-8 w-8 p-0">
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
});
