import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Coins, Loader2 } from "lucide-react";
import { TokenLogo } from "@/components/TokenLogo";
import type { PendingReward } from "@/lib/farm";

interface ClaimedTotal { contract?: string; symbol: string; amount: number }

interface StakingRewardsCardProps {
  isExpired: boolean;
  nextPayoutIn: number;
  pendingNextPayout: PendingReward[];
  pendingRewards: PendingReward[];
  hasRewards: boolean;
  isClaiming: boolean;
  onClaim: () => void;
  claimed?: ClaimedTotal[];
}

export function StakingRewardsCard({
  isExpired, nextPayoutIn, pendingNextPayout, pendingRewards, hasRewards, isClaiming, onClaim, claimed,
}: StakingRewardsCardProps) {
  return (
    <Card className="bg-card/80 border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-foreground">
          <Coins className="h-5 w-5 text-primary" />
          Rewards
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isExpired && (
          <Alert className="mb-4 border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-sm text-destructive">
              This farm has expired. Rewards are no longer accruing. Claim any remaining rewards.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <p className="text-xs text-foreground mb-2 font-medium">
              Pending
              {nextPayoutIn > 0 && (
                <span className="text-muted-foreground/70 ml-1">
                  (in {Math.floor(nextPayoutIn / 60)}:{(nextPayoutIn % 60).toString().padStart(2, "0")})
                </span>
              )}
            </p>
            {pendingNextPayout.length > 0 && pendingNextPayout.some((r) => r.amount > 0) ? (
              <div className="space-y-1.5">
                {pendingNextPayout.map((reward, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <TokenLogo contract={reward.contract ?? ""} symbol={reward.symbol} size="sm" className="opacity-70" />
                    <Badge variant="outline" className="text-foreground border-border/50 text-xs">
                      +{reward.amount.toFixed(reward.precision)} {reward.symbol}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-foreground text-sm">—</p>
            )}
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <p className="text-xs text-foreground mb-2 font-medium">Claimable Now</p>
            {pendingRewards.length > 0 && hasRewards ? (
              <div className="space-y-1.5">
                {pendingRewards.map((reward, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <TokenLogo contract={reward.contract ?? ""} symbol={reward.symbol} size="sm" className="h-5 w-5" />
                    <Badge variant="secondary" className="bg-primary/10 text-foreground border-primary/20">
                      {reward.amount.toFixed(reward.precision)} {reward.symbol}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No claimable rewards</p>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            onClick={onClaim}
            disabled={isClaiming || !hasRewards}
            className="w-full sm:w-1/2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isClaiming ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Coins className="h-4 w-4 mr-2" />}
            Claim Rewards
          </Button>
        </div>

        {(() => {
          const userClaimed = claimed;
          if (!userClaimed || userClaimed.length === 0) return null;
          return (
            <div className="mt-4 pt-4 border-t border-cheese/20">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                You've claimed (lifetime)
              </p>
              <div className="flex flex-wrap gap-3">
                {userClaimed.map((c, i) => (
                  <div key={`${c.contract}:${c.symbol}:${i}`} className="flex items-center gap-1.5 text-sm">
                    <TokenLogo contract={c.contract ?? ""} symbol={c.symbol} size="sm" />
                    <span className="font-mono text-cheese">
                      {c.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {c.symbol}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
