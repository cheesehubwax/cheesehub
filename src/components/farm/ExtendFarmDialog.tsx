import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, AlertTriangle } from "lucide-react";
import { FarmInfo, buildExtendFarmAction, calculateEffectiveBalance } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";

interface ExtendFarmDialogProps {
  farm: FarmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DURATION_PRESETS = [30, 60, 90, 180, 360];

export function ExtendFarmDialog({ farm, open, onOpenChange, onSuccess }: ExtendFarmDialogProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(
    farm.expiration > 0 ? new Date((farm.expiration + 30 * 86400) * 1000) : new Date(Date.now() + 60 * 86400 * 1000)
  );

  const shortfallInfo = useMemo(() => {
    if (!newDate) return null;
    const now = Math.floor(Date.now() / 1000);
    const newExp = Math.floor(newDate.getTime() / 1000);
    const hoursToNewExp = Math.max(0, (newExp - now) / 3600);

    return farm.reward_pools.map(pool => {
      const effective = calculateEffectiveBalance(pool, farm.last_payout, now);
      const totalNeeded = effective.hourlyRate * hoursToNewExp;
      const shortfall = Math.max(0, totalNeeded - effective.effectiveBalance);
      return {
        symbol: pool.symbol,
        shortfall,
        hoursRemaining: effective.hoursRemaining,
      };
    });
  }, [farm, newDate]);

  const handleExtend = async () => {
    if (!accountName || !newDate) return;
    setLoading(true);
    try {
      const expiration = Math.floor(newDate.getTime() / 1000);
      const action = buildExtendFarmAction(accountName, farm.farm_name, expiration);
      const result = await executeTransaction([action], {
        successTitle: "Farm Extended! ",
        successDescription: `Farm extended to ${newDate.toLocaleDateString()}`,
      });
      if (result.success) {
        onOpenChange(false);
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  const currentExpDate = farm.expiration > 0 ? new Date(farm.expiration * 1000) : new Date();

  const presetBase = farm.expiration > 0 ? currentExpDate : new Date();
  const isPresetActive = (days: number) => {
    if (!newDate) return false;
    const target = new Date(presetBase.getTime() + days * 86400 * 1000);
    return (
      target.getFullYear() === newDate.getFullYear() &&
      target.getMonth() === newDate.getMonth() &&
      target.getDate() === newDate.getDate()
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Extend Farm</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Current expiration: <strong>{currentExpDate.toLocaleDateString()}</strong>
          </p>
          <div>
            <Label>New Expiration Date</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {DURATION_PRESETS.map(d => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={isPresetActive(d) ? "default" : "outline"}
                  onClick={() => setNewDate(new Date(presetBase.getTime() + d * 86400 * 1000))}
                >
                  +{d}d
                </Button>
              ))}
            </div>
            <Calendar
              mode="single"
              selected={newDate}
              onSelect={setNewDate}
              disabled={(date) => date <= currentExpDate}
              className="rounded-md border mt-2"
            />
          </div>

          {shortfallInfo && shortfallInfo.some(s => s.shortfall > 0) && (
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 space-y-1">
              <div className="flex items-center gap-2 text-orange-400 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                Reward Shortfall
              </div>
              {shortfallInfo.filter(s => s.shortfall > 0).map((s, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {s.symbol}: Need ~{s.shortfall.toLocaleString(undefined, { maximumFractionDigits: 2 })} more tokens
                </p>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExtend} disabled={loading || !newDate} className="bg-primary text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Extend Farm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
