import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { buildClaimRewardsAction, type FarmInfo } from "@/lib/farm";
import { fetchUserStakerRows, formatUnits, planClaimBatches, splitReadyFarms, sumRewards, type ReadyFarm } from "@/lib/farmClaimAll";
import { applyClaimToAccount } from "@/lib/farmClaimHistory";
import { WAX_EXPLORER } from "@/lib/waxConfig";

const BATCH_SIZE = 5;

interface Props { open: boolean; onOpenChange: (o: boolean) => void; farms: FarmInfo[] }

export const farmTimings = (farms: FarmInfo[]) =>
  new Map(farms.map(f => [f.farm_name, { payoutInterval: f.payout_interval, expiration: f.expiration, isActive: f.is_active }]));

export const fmtList = (r: ReadyFarm["rewards"]) => r.map(x => `${formatUnits(x)} ${x.symbol}`).join(", ");

export function ClaimAllFarmsDialog({ open, onOpenChange, farms }: Props) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [results, setResults] = useState<Array<{ farms: string[]; txId: string | null }>>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["farmClaimAll", accountName],
    queryFn: () => fetchUserStakerRows(accountName!),
    enabled: open && !!accountName,
    staleTime: 0,
  });

  const { ready, empty } = useMemo(
    () => splitReadyFarms(data?.rows ?? [], farmTimings(farms), Math.floor(Date.now() / 1000)),
    [data, farms]);

  useEffect(() => { if (open) { setSelected(new Set(ready.map(r => r.farmName))); } }, [open, ready]);
  useEffect(() => { if (!open) { setResults([]); setProgress({ done: 0, total: 0 }); } }, [open]);

  const chosen = ready.filter(r => selected.has(r.farmName));
  const totals = sumRewards(chosen);

  const toggle = (name: string, on: boolean) => setSelected(prev => {
    const n = new Set(prev); if (on) n.add(name); else n.delete(name); return n;
  });

  const run = async () => {
    if (!accountName || !chosen.length) return;
    const batches = planClaimBatches(chosen, BATCH_SIZE);
    setRunning(true); setResults([]); setProgress({ done: 0, total: batches.length });
    const failed = new Set<string>();
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const res = await executeTransaction(batch.map(b => buildClaimRewardsAction(accountName, b.farmName)), {
        successTitle: `Claimed batch ${i + 1} of ${batches.length}`,
        successDescription: `Claimed from ${batch.map(b => b.farmName).join(", ")}`,
      });
      if (res.success && res.txId) {
        for (const b of batch) applyClaimToAccount(accountName, b.farmName,
          b.rewards.map(r => ({ symbol: r.symbol, contract: r.contract, amount: Number(formatUnits(r)) })));
        setResults(prev => [...prev, { farms: batch.map(b => b.farmName), txId: res.txId }]);
      } else {
        batch.forEach(b => failed.add(b.farmName));
        setResults(prev => [...prev, { farms: batch.map(b => b.farmName), txId: null }]);
      }
      setProgress({ done: i + 1, total: batches.length });
    }
    setRunning(false);
    setSelected(failed);
    queryClient.invalidateQueries({ queryKey: ["farms"] });
    queryClient.invalidateQueries({ queryKey: ["userStakes"] });
    queryClient.invalidateQueries({ queryKey: ["farmDetail"] });
    await refetch();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🧀 Claim All Rewards</DialogTitle>
          <DialogDescription>
            Claims are sent {BATCH_SIZE} farms per signature. Amounts may be slightly higher when signed, as rewards keep accruing.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {data?.partial && <p className="text-xs text-destructive">Not every staked farm could be read; some may be missing.</p>}
            {ready.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No farm rewards are ready to claim right now.</p>}
            {ready.map(r => (
              <label key={r.farmName} className="flex items-start gap-3 rounded-md border border-border/50 p-2 cursor-pointer">
                <Checkbox checked={selected.has(r.farmName)} disabled={running} onCheckedChange={v => toggle(r.farmName, !!v)} className="mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.farmName}</p>
                  <p className="text-xs text-muted-foreground">{fmtList(r.rewards)}</p>
                </div>
              </label>
            ))}
            {empty.map(n => (
              <div key={n} className="flex items-center gap-3 rounded-md border border-border/30 p-2 opacity-50">
                <Checkbox disabled checked={false} />
                <p className="text-sm truncate">{n} <span className="text-xs text-muted-foreground">— nothing to claim</span></p>
              </div>
            ))}
          </div>
        )}

        {totals.length > 0 && (
          <div className="rounded-md bg-muted/40 p-2 text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="text-cheese font-medium">{fmtList(totals)}</span>
          </div>
        )}

        {progress.total > 0 && (
          <div className="space-y-2">
            <Progress value={(progress.done / progress.total) * 100} />
            <p className="text-xs text-muted-foreground">Batch {progress.done} of {progress.total}</p>
            {results.map((r, i) => (
              <p key={i} className="text-xs">
                {r.txId
                  ? <a href={`${WAX_EXPLORER}${r.txId}`} target="_blank" rel="noopener noreferrer" className="text-cheese underline">✅ Batch {i + 1}: {r.txId.slice(0, 10)}…</a>
                  : <span className="text-destructive">❌ Batch {i + 1} failed ({r.farms.join(", ")}) — still ticked to retry</span>}
              </p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Close</Button>
          <Button onClick={run} disabled={running || chosen.length === 0}>
            {running ? "Claiming…" : `Claim ${chosen.length} farm${chosen.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
