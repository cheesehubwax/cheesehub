import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { buildEditPropCostAction } from "@/lib/dao";
import { ProposalFeeInput, ProposalFeeValue } from "@/components/dao/ProposalFeeInput";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";

interface EditProposalCostProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  daoName: string;
  currentCost: string;
  onUpdated: () => void;
}

export function EditProposalCost({ open, onOpenChange, daoName, currentCost, onUpdated }: EditProposalCostProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [loading, setLoading] = useState(false);
  const [feeToken, setFeeToken] = useState<ProposalFeeValue>(() => {
    const parts = currentCost.split(" ");
    const amount = parseFloat(parts[0]) || 0;
    // The dao.waxdao contract requires WAX for proposal_cost.
    return { amount, symbol: "WAX", contract: "eosio.token", precision: 8 };
  });

  const handleSave = async () => {
    if (!session || !accountName) return;
    setLoading(true);
    const formatted = `${feeToken.amount.toFixed(8)} WAX`;
    const action = buildEditPropCostAction(accountName, daoName, formatted);
    const result = await executeTransaction([action], {
      successTitle: "Proposal Cost Updated! 🧀",
      successDescription: `New cost: ${formatted}`,
    });

    if (result.success) {
      onUpdated();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Proposal Cost</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Current Cost</Label>
            <p className="text-sm text-muted-foreground">{currentCost || "Free"}</p>
          </div>
          <div>
            <Label>New Cost</Label>
            <div className="mt-1">
              <ProposalFeeInput value={feeToken} onChange={setFeeToken} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Set to 0 for free proposals. Fees must be in WAX (contract requirement).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Cost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
