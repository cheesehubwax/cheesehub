import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Loader2 } from "lucide-react";
import { FarmInfo, buildOpenFarmAction } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";

interface OpenFarmDialogProps {
  farm: FarmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DURATION_PRESETS = [30, 60, 90, 180, 360];

export function OpenFarmDialog({ farm, open, onOpenChange, onSuccess }: OpenFarmDialogProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [loading, setLoading] = useState(false);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

  const hasRewards = farm.reward_pools.some(p => parseFloat(p.balance) > 0);

  const isPresetActive = (days: number) => {
    if (!expirationDate) return false;
    const target = new Date(Date.now() + days * 86400 * 1000);
    return (
      target.getFullYear() === expirationDate.getFullYear() &&
      target.getMonth() === expirationDate.getMonth() &&
      target.getDate() === expirationDate.getDate()
    );
  };

  const handleOpen = async () => {
    if (!accountName || !expirationDate) return;
    setLoading(true);
    try {
      const expiration = Math.floor(expirationDate.getTime() / 1000);
      const action = buildOpenFarmAction(accountName, farm.farm_name, expiration);
      const result = await executeTransaction([action], {
        successTitle: "Farm Opened! 🎉",
        successDescription: `${farm.farm_name} is now accepting stakers`,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Open Farm</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!hasRewards && (
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm text-orange-400">
              ⚠️ Your farm has no rewards deposited. Consider depositing rewards before opening.
            </div>
          )}
          <div>
            <Label>Expiration Date</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {DURATION_PRESETS.map(d => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={isPresetActive(d) ? "default" : "outline"}
                  onClick={() => setExpirationDate(new Date(Date.now() + d * 86400 * 1000))}
                >
                  {d}d
                </Button>
              ))}
            </div>
            <Calendar
              mode="single"
              selected={expirationDate}
              onSelect={setExpirationDate}
              disabled={(date) => date < new Date()}
              className="rounded-md border mt-2"
            />
          </div>
          {expirationDate && (
            <p className="text-sm text-muted-foreground">
              Farm will expire on {expirationDate.toLocaleDateString()} at {expirationDate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleOpen} disabled={loading || !expirationDate} className="bg-green-600 hover:bg-green-700 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Open Farm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
