import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { buildEditPropCostAction, PROPOSAL_FEE_TOKENS } from "@/lib/dao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [cost, setCost] = useState(() => {
    const parts = currentCost.split(" ");
    return parseFloat(parts[0]) || 0;
  });
  const [symbol, setSymbol] = useState(() => {
    const parts = currentCost.split(" ");
    const s = parts[1] || "WAX";
    return PROPOSAL_FEE_TOKENS.some(t => t.symbol === s) ? s : "WAX";
  });

  const handleSave = async () => {
    if (!session || !accountName) return;
    setLoading(true);

    const token = PROPOSAL_FEE_TOKENS.find(t => t.symbol === symbol) ?? PROPOSAL_FEE_TOKENS[0];
    const formatted = `${cost.toFixed(token.precision)} ${token.symbol}`;
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
      <DialogContent className="max-w-sm">
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
            <div className="flex gap-2">
              <Input
                type="number"
                value={cost}
                onChange={e => setCost(parseFloat(e.target.value) || 0)}
                min={0}
                step={0.00000001}
                placeholder="0 for free"
                className="flex-1"
              />
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROPOSAL_FEE_TOKENS.map(t => (
                    <SelectItem key={t.symbol} value={t.symbol}>{t.symbol}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Set to 0 for free proposals</p>
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
