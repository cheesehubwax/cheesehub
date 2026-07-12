import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { FarmInfo, buildWithdrawRewardsAction } from "@/lib/farm";
import { TokenLogo } from "@/components/TokenLogo";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";

interface WithdrawRewardsDialogProps {
  farm: FarmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function WithdrawRewardsDialog({ farm, open, onOpenChange, onSuccess }: WithdrawRewardsDialogProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [loading, setLoading] = useState(false);
  const [amounts, setAmounts] = useState<Record<number, string>>({});

  const handleWithdraw = async () => {
    if (!accountName) return;
    setLoading(true);
    try {
      const actions = farm.reward_pools
        .map((pool, i) => {
          const amount = parseFloat(amounts[i] || "0");
          if (amount <= 0) return null;
          const formatted = `${amount.toFixed(pool.precision)} ${pool.symbol}`;
          return buildWithdrawRewardsAction(accountName, farm.farm_name, pool.contract, formatted);
        })
        .filter(Boolean) as any[];

      if (actions.length === 0) return;

      const result = await executeTransaction(actions, {
        successTitle: "Rewards Withdrawn! ",
        successDescription: "Reward tokens have been withdrawn from the farm",
      });
      if (result.success) {
        setAmounts({});
        onOpenChange(false);
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw Rewards</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Withdraw excess reward tokens from your farm's pools.
          </p>
          {farm.reward_pools.map((pool, i) => (
            <div key={i} className="flex items-center gap-3">
              <TokenLogo contract={pool.contract} symbol={pool.symbol} size="md" />
              <div className="flex-1">
                <Label className="text-xs">{pool.symbol} ({pool.contract})</Label>
                <Input
                  type="number"
                  value={amounts[i] || ""}
                  onChange={(e) => setAmounts({ ...amounts, [i]: e.target.value })}
                  placeholder="0.0000"
                  step="0.0001"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Current balance: {pool.balance} {pool.symbol}
                </p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleWithdraw}
            disabled={loading || Object.values(amounts).every(a => !a || parseFloat(a) <= 0)}
            className="bg-primary text-primary-foreground"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Withdraw
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
