import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Coins } from "lucide-react";
import type { PendingReward } from "@/lib/farm";

interface ConfirmStakeClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmName: string;
  pendingRewards: PendingReward[];
  onConfirm: () => void;
}

/** Staking more NFTs auto-claims pending rewards on chain; this states it first. */
export function ConfirmStakeClaimDialog({ open, onOpenChange, farmName, pendingRewards, onConfirm }: ConfirmStakeClaimDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-cheese" />
            Pending rewards will be claimed
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Staking additional NFTs into{" "}
                <span className="font-semibold text-cheese">{farmName}</span>{" "}
                will auto-claim your current pending rewards in the same transaction:
              </p>
              <div className="rounded-md border border-cheese/30 bg-cheese/5 p-3 space-y-1">
                {pendingRewards
                  .filter((r) => r.amount > 0)
                  .map((r) => (
                    <div key={r.symbol} className="flex justify-between font-mono">
                      <span className="text-muted-foreground">{r.symbol}</span>
                      <span className="text-cheese">
                        {r.amount.toFixed(r.precision)}
                      </span>
                    </div>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground">
                This is enforced by the farm smart contract and cannot be skipped.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Claim & Stake
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
