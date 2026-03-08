import { TrendingUp, Droplet, Flame, Zap } from 'lucide-react';
import { useCheeseNullStats } from '@/hooks/useCheeseNullStats';
import { formatWaxAmount, formatCheeseAmount } from '@/lib/cheeseNullApi';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function NullTotalStats() {
  const {
    totalBurns,
    totalCheeseNulled,
    totalCheeseLiquidity,
    totalWaxCompounded,
    totalWaxCheesepowerz,
    isLoading,
    isError,
  } = useCheeseNullStats();

  return (
    <Card className="w-full max-w-md bg-card/50 border-border/50">
      <CardContent className="p-5 space-y-4">
        <div className="text-center">
          <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Lifetime Statistics
          </h3>
        </div>

        {/* Total CHEESE Nulled */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <Flame className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Total CHEESE Nulled</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-40 mx-auto bg-muted" />
          ) : isError ? (
            <p className="text-xs text-muted-foreground italic">Stats temporarily unavailable</p>
          ) : (
            <p className="text-xl font-bold text-cheese">
              {formatCheeseAmount(totalCheeseNulled)} <span className="text-sm text-muted-foreground">CHEESE</span>
            </p>
          )}
        </div>

        {/* Distribution Breakdown */}
        {!isLoading && !isError && (
          <div className="flex items-center justify-center gap-4 pt-1">
            <div className="text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Droplet className="w-3 h-3" />
                <span className="text-[10px] font-medium">xCHEESE</span>
              </div>
              <p className="text-sm font-semibold text-cheese">{formatCheeseAmount(totalCheeseLiquidity)} <span className="text-[11px] text-muted-foreground">CHEESE</span></p>
            </div>
            <div className="text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span className="text-[10px] font-medium">CheesePowerz</span>
              </div>
              <p className="text-sm font-semibold text-cheese">{formatWaxAmount(totalWaxCheesepowerz)} <span className="text-[11px] text-muted-foreground">WAX</span></p>
            </div>
            <div className="text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <TrendingUp className="w-3 h-3" />
                <span className="text-[10px] font-medium">Compound</span>
              </div>
              <p className="text-sm font-semibold text-cheese">{formatWaxAmount(totalWaxCompounded)} <span className="text-[11px] text-muted-foreground">WAX</span></p>
            </div>
          </div>
        )}

        {/* Total Nulls Count */}
        {!isLoading && !isError && (
          <div className="text-center pt-1 border-t border-cheese/10">
            <p className="text-xs text-muted-foreground">
              Total Nulls: <span className="font-semibold text-cheese">{totalBurns.toLocaleString()}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
