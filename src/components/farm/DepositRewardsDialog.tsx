import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";
import { FarmInfo, buildAddRewardsAction } from "@/lib/farm";
import { TokenLogo } from "@/components/TokenLogo";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsDialog } from "@/components/shared/TermsDialog";

interface DepositRewardsDialogProps {
  farm: FarmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  isCreator?: boolean;
}

export function DepositRewardsDialog({ farm, open, onOpenChange, onSuccess, isCreator = false }: DepositRewardsDialogProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [loading, setLoading] = useState(false);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [termsAgreed, setTermsAgreed] = useState(false);

  const handleDeposit = async () => {
    if (!accountName) return;
    setLoading(true);
    try {
      const actions = farm.reward_pools
        .map((pool, i) => {
          const amount = parseFloat(amounts[i] || "0");
          if (amount <= 0) return null;
          const formatted = `${amount.toFixed(pool.precision)} ${pool.symbol}`;
          return buildAddRewardsAction(accountName, farm.farm_name, pool.contract, formatted);
        })
        .filter(Boolean) as any[];

      if (actions.length === 0) return;

      const result = await executeTransaction(actions, {
        successTitle: "Reward pool funded",
        successDescription: "Reward tokens have been deposited into the farm's reward pool for stakers to later claim.",
      });
      if (result.success) {
        setAmounts({});
        setTermsAgreed(false);
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
          <DialogTitle>Deposit Rewards to Farm</DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">
            <span className="font-mono text-foreground">{farm.farm_name}</span>
            {" "}· by <span className="font-mono">{farm.creator}</span>
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Anyone can sponsor this farm by depositing reward tokens. Deposited tokens are sent directly to the
            {" "}<code className="text-foreground bg-muted px-1 rounded text-xs">farms.waxdao</code> contract and
            distributed to stakers — they cannot be withdrawn except by the farm creator.
          </p>
          {!isCreator && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-400">
                You are not the creator of this farm. Deposits are non-refundable and will be distributed to stakers.
              </p>
            </div>
          )}
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
          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="terms-deposit-rewards"
              checked={termsAgreed}
              onCheckedChange={(v) => setTermsAgreed(v === true)}
              className="mt-0.5"
            />
            <label htmlFor="terms-deposit-rewards" className="text-sm cursor-pointer leading-relaxed text-muted-foreground">
              I have read the <TermsDialog /> and understand that deposits to{" "}
              <code className="text-foreground bg-muted px-1 rounded text-xs">farms.waxdao</code> are non-refundable.
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleDeposit}
            disabled={loading || !termsAgreed || Object.values(amounts).every(a => !a || parseFloat(a) <= 0)}
            className="bg-primary text-primary-foreground"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Deposit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
