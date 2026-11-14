import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { STATUS_LABEL, chainName, fetchHops, formatRawUnits, hopPercent, isInFlight } from "@/lib/alcorBridge";
import { TokenLogo } from "@/components/TokenLogo";
import alcorIcon from "@/assets/alcor-icon.svg.asset.json";

export function BridgeTransfersCard({ account }: { account: string | null }) {
  const q = useQuery({
    queryKey: ["alcor-bridge-hops", account],
    queryFn: () => fetchHops(account!),
    enabled: !!account,
    staleTime: 15_000,
    refetchInterval: (query) => (query.state.data?.some(isInFlight) ? 15_000 : false),
    refetchIntervalInBackground: false,
  });

  return (
    <Card className="alcor-panel rounded-lg border-border font-sans">
      <CardHeader className="p-4 pb-2"><CardTitle className="flex items-center gap-2 text-base font-semibold"><img src={alcorIcon.url} alt="" aria-hidden="true" className="h-5 w-5 shrink-0 object-contain" />Your transfers</CardTitle></CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {!account && <p className="text-sm text-muted-foreground">Connect your wallet to see your bridge transfers.</p>}
        {account && q.isLoading && <p className="text-sm text-muted-foreground">Loading transfers…</p>}
        {account && q.isError && <p className="text-sm text-destructive">Transfers unavailable right now.</p>}
        {q.data && q.data.length === 0 && <p className="text-sm text-muted-foreground">No bridge transfers yet.</p>}
        {q.data?.slice(0, 20).map((h) => {
          const pct = hopPercent(h);
          const amt = h.deposit?.amount && h.deposit.precision != null ? formatRawUnits(h.deposit.amount, h.deposit.precision) : null;
          return (
            <div key={h.key} className="border-t border-border py-3 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium tabular-nums">{h.deposit?.symbol && <TokenLogo contract={h.deposit.symbol.toUpperCase() === "WAX" ? "eosio.token" : "wrap.alcor"} symbol={h.deposit.symbol} size="sm" />}{amt ?? "?"} {h.deposit?.symbol ?? ""}</span>
                <span className="text-muted-foreground">{chainName(h.from?.chain ?? "?")} → {chainName(h.to?.chain ?? "?")}</span>
              </div>
              <div className="text-muted-foreground">{h.progress?.stage ?? STATUS_LABEL[h.status] ?? h.status}</div>
              {pct != null && <Progress value={pct} className="h-1.5" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
