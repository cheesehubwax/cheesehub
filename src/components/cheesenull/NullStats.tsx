import { RefreshCw, Clock, CheckCircle, TrendingUp, Droplet, Zap } from 'lucide-react';
import { useCheeseNullData } from '@/hooks/useCheeseNullData';
import { formatWaxAmount, formatCheeseAmount, formatCountdown } from '@/lib/cheeseNullApi';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface NullStatsProps {
  onCanClaimChange?: (canClaim: boolean) => void;
}

export function NullStats({ onCanClaimChange }: NullStatsProps) {
  const {
    cheeseBurnAmount,
    cheeseLiquidityAmount,
    waxStakeAmount,
    waxCheesepowerzAmount,
    canClaim,
    timeUntilNextClaim,
    isLoading,
    isError,
    refetch,
  } = useCheeseNullData();

  if (onCanClaimChange) {
    onCanClaimChange(canClaim);
  }

  return (
    <Card className="w-full max-w-md bg-card/50 border-border/50">
      <CardContent className="p-6 space-y-6">
        {/* Estimated CHEESE Burn */}
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Current Estimated $CHEESE Null
            </h3>
            {isLoading ? (
              <Skeleton className="h-10 w-56 mx-auto bg-muted" />
            ) : isError ? (
              <p className="text-destructive text-sm">Error loading data</p>
            ) : (
              <p className="text-3xl font-bold text-cheese">
                {formatCheeseAmount(cheeseBurnAmount)} <span className="text-lg text-muted-foreground">CHEESE</span>
              </p>
            )}
          </div>

          {/* Distribution Breakdown */}
          {!isLoading && !isError && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <div className="text-center space-y-0.5">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Droplet className="w-3 h-3" />
                  <span className="text-[10px] font-medium">xCHEESE</span>
                </div>
                <p className="text-sm font-semibold text-cheese">{formatCheeseAmount(cheeseLiquidityAmount)} <span className="text-[11px] text-muted-foreground">CHEESE</span></p>
              </div>
              <div className="text-center space-y-0.5">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Zap className="w-3 h-3" />
                  <span className="text-[10px] font-medium">CheesePowerz</span>
                </div>
                <p className="text-sm font-semibold text-cheese">{formatWaxAmount(waxCheesepowerzAmount)} <span className="text-[11px] text-muted-foreground">WAX</span></p>
              </div>
              <div className="text-center space-y-0.5">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-[10px] font-medium">Compound</span>
                </div>
                <p className="text-sm font-semibold text-cheese">{formatWaxAmount(waxStakeAmount)} <span className="text-[11px] text-muted-foreground">WAX</span></p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-cheese/10" />

        {/* Cooldown Status */}
        <div className="text-center space-y-2">
          {isLoading ? (
            <Skeleton className="h-6 w-40 mx-auto bg-muted" />
          ) : canClaim ? (
            <div className="flex items-center justify-center gap-2 text-green-500">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-semibold">Ready!</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                Next null in: <span className="font-mono font-semibold text-cheese">{formatCountdown(timeUntilNextClaim)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={refetch}
          disabled={isLoading}
          className={cn(
            'flex items-center justify-center gap-2 mx-auto',
            'text-xs text-muted-foreground hover:text-cheese transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </CardContent>
    </Card>
  );
}
