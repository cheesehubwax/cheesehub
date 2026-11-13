import { useQuery } from "@tanstack/react-query";
import { TokenLogo } from "@/components/TokenLogo";
import { chainName, fetchRoutes, formatRawUnits, waxRoutes, type BridgeRoute } from "@/lib/alcorBridge";

/** WAX-side contracts for bridge tokens, so logos come from our usual token logo source. */
const logoContract = (symbol: string) => (symbol === "WAX" ? "eosio.token" : "wrap.alcor");

function RouteRow({ r, side }: { r: BridgeRoute; side: "from" | "to" }) {
  const fmt = (v: string) => formatRawUnits(v, r.precision) ?? "unavailable";
  return (
    <tr className="border-t border-[#24262d] transition-colors hover:bg-[#16181d]">
      <td className="py-2 pr-2">
        <span className="flex items-center gap-2 font-medium text-[#f1f2f4]">
          <TokenLogo contract={logoContract(r.symbol)} symbol={r.symbol} size="md" className="h-5 w-5" />
          {r.symbol}
        </span>
      </td>
      <td className="py-2 text-[#c5c8d0]">{chainName(side === "from" ? r.from : r.to)}</td>
      <td className="py-2 text-right tabular-nums text-[#c5c8d0]">{fmt(r.min)}</td>
      <td className="py-2 text-right tabular-nums text-[#c5c8d0]">{fmt(r.max)}</td>
      <td className="py-2 pl-2 text-right">
        {r.open ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#1f5a3d] bg-[#0f2a1d] px-2 py-0.5 text-[10px] font-medium text-[#4ade80]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ade80]" />Open
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-[#5a1f2a] bg-[#2a0f15] px-2 py-0.5 text-[10px] font-medium text-[#f87171]">Paused</span>
        )}
      </td>
    </tr>
  );
}

function RouteTable({ title, side, rows }: { title: string; side: "from" | "to"; rows: BridgeRoute[] }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-[#f1f2f4]">{title}</h4>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-[#8b8f99]">
          <tr>
            <th className="pb-1.5 text-left font-medium">Token</th>
            <th className="pb-1.5 text-left font-medium">{side === "from" ? "From" : "To"}</th>
            <th className="pb-1.5 text-right font-medium">Min</th>
            <th className="pb-1.5 text-right font-medium">Max</th>
            <th className="pb-1.5 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>{rows.map((r) => <RouteRow key={`${r.symbol}-${r.from}-${r.to}`} r={r} side={side} />)}</tbody>
      </table>
    </div>
  );
}

/** Styled to match Alcor's dark bridge widget it sits beside. */
export function BridgeRoutesCard() {
  const q = useQuery({ queryKey: ["alcor-bridge-routes"], queryFn: fetchRoutes, staleTime: 5 * 60_000, refetchOnWindowFocus: true });
  const split = q.data ? waxRoutes(q.data) : null;
  return (
    <div className="rounded-lg border border-[#24262d] bg-[#0b0c0f] p-4 font-sans text-[#f1f2f4]">
      <h3 className="mb-4 text-base font-semibold">📡 Route status</h3>
      <div className="space-y-5">
        {q.isLoading && <p className="text-sm text-[#8b8f99]">Checking routes…</p>}
        {q.isError && <p className="text-sm text-[#f87171]">Route status unavailable right now.</p>}
        {split && (
          <>
            <RouteTable title="Into WAX" side="from" rows={split.into} />
            <RouteTable title="Out of WAX" side="to" rows={split.outOf} />
          </>
        )}
      </div>
    </div>
  );
}
