import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { FarmInfo, buildKickManyAction } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";

interface KickUsersDialogProps {
  farm: FarmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function KickUsersDialog({ farm, open, onOpenChange, onSuccess }: KickUsersDialogProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("10");

  const handleKick = async () => {
    if (!accountName) return;
    setLoading(true);
    try {
      const num = parseInt(amount) || 10;
      const action = buildKickManyAction(accountName, farm.farm_name, num);
      const result = await executeTransaction([action], {
        successTitle: "Stakers Kicked",
        successDescription: `Kicked up to ${num} stakers from ${farm.farm_name}`,
      });
      if (result.success) {
        onOpenChange(false);
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Kick Stakers</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Kick stakers from your permanently closed farm. Their NFTs will be returned.
          </p>
          <div>
            <Label>Number of stakers to kick</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={1} max={200} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleKick} disabled={loading} className="bg-primary text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Kick Stakers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
