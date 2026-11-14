import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TokenLogo } from "@/components/TokenLogo";
import { chainName, fetchRoutes, formatRawUnits, waxRoutes, type BridgeRoute } from "@/lib/alcorBridge";

/** WAX-side contracts for bridge tokens, so logos come from our usual token logo source. */
const logoContract = (symbol: string) => (symbol === "WAX" ? "eosio.token" : "wrap.alcor");
const routeKey = (r: BridgeRoute) => `${r.symbol}-${r.from}-${r.to}`;

/** Pinned route first, then routes for the chosen token, then the rest (original order kept). */
function orderRoutes(rows: BridgeRoute[], pinned: string | null, token: string | null) {
  const rank = (r: BridgeRoute) => (routeKey(r) === pinned ? 0 : token && r.symbol === token ? 1 : 2);
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r);
}

function RouteRow({ r, side, pinned, dimmed, onPick, rowRef }: {
  r: BridgeRoute; side: "from" | "to"; pinned: boolean; dimmed: boolean;
  onPick: () => void; rowRef: (el: HTMLTableRowElement | null) => void;
}) {
  const fmt = (v: string) => formatRawUnits(v, r.precision) ?? "unavailable";
  return (
    <tr
      ref={rowRef}
      onClick={onPick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } }}
      tabIndex={0}
      aria-pressed={pinned}
      title={pinned ? "Pinned — click to unpin" : "Click to pin this route to the top"}
      className={`cursor-pointer border-t border-[#24262d] transition-colors focus:outline-none focus-visible:bg-[#16181d] ${
        pinned ? "bg-cheese/10 shadow-[inset_3px_0_0_hsl(var(--cheese)),0_0_12px_hsl(var(--cheese)/0.25)]" : "hover:bg-[#16181d]"
      } ${dimmed ? "opacity-50" : ""}`}
    >
      <td className="py-2 pl-2 pr-2">
        <span className={`flex items-center gap-2 font-medium ${pinned ? "text-cheese" : "text-[#f1f2f4]"}`}>
          <TokenLogo contract={logoContract(r.symbol)} symbol={r.symbol} size="md" className="h-5 w-5" />
          {r.symbol}{pinned && <span aria-hidden>📌</span>}
        </span>
      </td>
      <td className="py-2 text-[#c5c8d0]">{chainName(side === "from" ? r.from : r.to)}</td>
      <td className="py-2 text-right tabular-nums text-[#c5c8d0]">{fmt(r.min)}</td>
      <td className="py-2 text-right tabular-nums text-[#c5c8d0]">{fmt(r.max)}</td>
      <td className="py-2 pl-2 pr-1 text-right">
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

function RouteTable({ title, side, rows, pinned, token, onPick }: {
  title: string; side: "from" | "to"; rows: BridgeRoute[]; pinned: string | null; token: string | null; onPick: (k: string) => void;
}) {
  const ordered = useMemo(() => orderRoutes(rows, pinned, token), [rows, pinned, token]);
  const els = useRef(new Map<string, HTMLTableRowElement>());
  const last = useRef(new Map<string, number>());

  // FLIP: rows glide from their previous spot to their new one whenever the order changes.
  useLayoutEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    els.current.forEach((el, k) => {
      const top = el.getBoundingClientRect().top;
      next.set(k, top);
      const prev = last.current.get(k);
      if (reduce || prev === undefined || prev === top) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${prev - top}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      });
    });
    last.current = next;
  }, [ordered]);

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-[#f1f2f4]">{title}</h4>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-[#8b8f99]">
          <tr>
            <th className="pb-1.5 pl-2 text-left font-medium">Token</th>
            <th className="pb-1.5 text-left font-medium">{side === "from" ? "From" : "To"}</th>
            <th className="pb-1.5 text-right font-medium">Min</th>
            <th className="pb-1.5 text-right font-medium">Max</th>
            <th className="pb-1.5 pr-1 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((r) => {
            const k = routeKey(r);
            return (
              <RouteRow
                key={k} r={r} side={side}
                pinned={k === pinned}
                dimmed={!!token && r.symbol !== token && k !== pinned}
                onPick={() => onPick(k)}
                rowRef={(el) => { if (el) els.current.set(k, el); else els.current.delete(k); }}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Styled to match Alcor's dark bridge widget it sits beside. */
export function BridgeRoutesCard() {
  const q = useQuery({ queryKey: ["alcor-bridge-routes"], queryFn: fetchRoutes, staleTime: 5 * 60_000, refetchOnWindowFocus: true });
  const split = q.data ? waxRoutes(q.data) : null;
  const [pinned, setPinned] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const tokens = useMemo(() => {
    if (!split) return [];
    return Array.from(new Set(split.into.map((r) => r.symbol)));
  }, [split]);
  const pick = (k: string) => setPinned((p) => (p === k ? null : k));

  const pill = (label: string, value: string | null) => {
    const active = token === value;
    return (
      <button
        key={label}
        type="button"
        onClick={() => setToken(value)}
        aria-pressed={active}
        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
          active ? "border-cheese bg-cheese/15 text-cheese" : "border-[#24262d] bg-[#121317] text-[#c5c8d0] hover:bg-[#16181d]"
        }`}
      >
        {value && <TokenLogo contract={logoContract(value)} symbol={value} size="sm" className="h-3.5 w-3.5" />}
        {label}
      </button>
    );
  };

  return (
    <div className="rounded-lg border border-[#24262d] bg-[#0b0c0f] p-4 font-sans text-[#f1f2f4]">
      <h3 className="mb-1 text-base font-semibold">📡 Route status</h3>
      <p className="mb-3 text-[11px] text-[#8b8f99]">Routes into WAX. Pick a token or click your route to pin it to the top.</p>
      {tokens.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {pill("All", null)}
          {tokens.map((t) => pill(t, t))}
        </div>
      )}
      <div className="space-y-5">
        {q.isLoading && <p className="text-sm text-[#8b8f99]">Checking routes…</p>}
        {q.isError && <p className="text-sm text-[#f87171]">Route status unavailable right now.</p>}
        {split && (
          <RouteTable title="Into WAX" side="from" rows={split.into} pinned={pinned} token={token} onPick={pick} />
        )}
      </div>
    </div>
  );
}
