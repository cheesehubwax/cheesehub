import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chainName, fetchRoutes, formatRawUnits, waxRoutes, type BridgeRoute } from "@/lib/alcorBridge";

function RouteRow({ r, side }: { r: BridgeRoute; side: "from" | "to" }) {
  const fmt = (v: string) => formatRawUnits(v, r.precision) ?? "unavailable";
  return (
    <tr className="border-t border-border/50">
      <td className="py-1.5 font-medium">{r.symbol}</td>
      <td className="py-1.5">{chainName(side === "from" ? r.from : r.to)}</td>
      <td className="py-1.5 text-right tabular-nums">{fmt(r.min)}</td>
      <td className="py-1.5 text-right tabular-nums">{fmt(r.max)}</td>
      <td className="py-1.5 text-right">{r.open ? <span className="text-primary">Open</span> : <span className="text-destructive">Paused</span>}</td>
    </tr>
  );
}

function RouteTable({ title, side, rows }: { title: string; side: "from" | "to"; rows: BridgeRoute[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-1">{title}</h4>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr><th className="text-left font-normal">Token</th><th className="text-left font-normal">{side === "from" ? "From" : "To"}</th><th className="text-right font-normal">Min</th><th className="text-right font-normal">Max</th><th className="text-right font-normal">Status</th></tr>
        </thead>
        <tbody>{rows.map((r) => <RouteRow key={`${r.symbol}-${r.from}-${r.to}`} r={r} side={side} />)}</tbody>
      </table>
    </div>
  );
}

export function BridgeRoutesCard() {
  const q = useQuery({ queryKey: ["alcor-bridge-routes"], queryFn: fetchRoutes, staleTime: 5 * 60_000, refetchOnWindowFocus: true });
  const split = q.data ? waxRoutes(q.data) : null;
  return (
    <Card className="bg-card/80 border-border/50">
      <CardHeader className="pb-2"><CardTitle className="text-base">📡 Route status</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading && <p className="text-sm text-muted-foreground">Checking routes…</p>}
        {q.isError && <p className="text-sm text-destructive">Route status unavailable right now.</p>}
        {split && (
          <>
            <RouteTable title="Into WAX" side="from" rows={split.into} />
            <RouteTable title="Out of WAX" side="to" rows={split.outOf} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
