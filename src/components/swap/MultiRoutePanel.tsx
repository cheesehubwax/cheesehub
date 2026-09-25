import { useMemo } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { TokenLogo } from "@/components/TokenLogo";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useAlcorPools } from "@/hooks/useAlcorPools";
import type { SwapRoute, SwapToken, AlcorPoolToken, SwapRouteCandidate } from "@/lib/swapApi";
import { VenueLogo } from "@/components/anal/VenueLogo";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { redistributeAllocations, type ManualAllocation } from "@/lib/manualSwap";




const VENUE_NAMES = { alcor: "Alcor", defibox: "Defibox", taco: "TacoSwap" } as const;

interface MultiRoutePanelProps {
  route: SwapRoute;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  manualMode: boolean;
  manualAllocations?: ManualAllocation[];
  candidates: SwapRouteCandidate[];
  canUseManual: boolean;
  onEnableManual: () => void;
  onResetAuto: () => void;
  onAllocationsChange: (allocations: ManualAllocation[]) => void;
}

function candidateLabel(candidate: SwapRouteCandidate): string {
  const path = candidate.visualPath.map((token) => token.symbol).join(" → ");
  return `${VENUE_NAMES[candidate.venue]} · ${path}`;
}

function hasVisualRoute(split: SwapRoute["swaps"][number]): boolean {
  if (split.venue && split.venue !== "alcor") return true;
  return (
    Array.isArray(split.visualPath) &&
    Array.isArray(split.visualFees) &&
    split.visualPath.length === split.route.length + 1 &&
    split.visualFees.length === split.route.length
  );
}

function formatFee(fee: number): string {
  // Alcor stores fee as basis-points * 10 (e.g. 3000 → 0.3%, 500 → 0.05%)
  const pct = fee / 10000;
  return `${+pct.toFixed(4)}%`;
}

function tokenInId(t: SwapToken): string {
  return `${t.ticker.toLowerCase()}-${t.contract}`;
}

export function MultiRoutePanel({
  route,
  tokenIn,
  tokenOut,
  manualMode,
  manualAllocations = [],
  candidates,
  canUseManual,
  onEnableManual,
  onResetAuto,
  onAllocationsChange,
}: MultiRoutePanelProps) {
  const allIds = useMemo(() => {
    const ids: number[] = [];
    route.swaps.forEach((s) => {
      if (!hasVisualRoute(s)) s.route.forEach((id) => ids.push(id));
    });
    return ids;
  }, [route.swaps]);

  const { pools, isReady, hasError } = useAlcorPools(allIds);

  const startId = tokenInId(tokenIn);

  const rows = useMemo(() => {
    return route.swaps.map((split) => {
      if (hasVisualRoute(split)) {
        return {
          split,
          chain: split.visualPath!,
          hopFees: split.visualFees!,
          broken: false,
        };
      }

      const chain: AlcorPoolToken[] = [
        {
          id: startId,
          symbol: tokenIn.ticker,
          contract: tokenIn.contract,
          decimals: tokenIn.precision,
        },
      ];
      const hopFees: number[] = [];
      let currentId = startId;
      let broken = false;
      for (const poolId of split.route) {
        const pool = pools.get(poolId);
        if (!pool) {
          broken = true;
          break;
        }
        const next = pool.tokenA.id === currentId ? pool.tokenB : pool.tokenA;
        chain.push(next);
        hopFees.push(pool.fee);
        currentId = next.id;
      }
      return { split, chain, hopFees, broken };
    });
  }, [route.swaps, pools, startId, tokenIn.ticker, tokenIn.contract, tokenIn.precision]);

  const needsPoolLookup = allIds.length > 0;
  const selectedKeys = new Set(manualAllocations.map((item) => item.key));
  const addable = candidates.filter((candidate) => !selectedKeys.has(candidate.key));

  const addRoute = (key: string) => {
    if (!key || manualAllocations.length >= 6) return;
    if (manualAllocations.length === 0) {
      onAllocationsChange([{ key, bps: 10_000 }]);
      return;
    }
    const resized = manualAllocations.map((item) => ({ ...item, bps: Math.floor(item.bps * 0.99) }));
    const assigned = resized.reduce((sum, item) => sum + item.bps, 0);
    onAllocationsChange([...resized, { key, bps: 10_000 - assigned }]);
  };

  const removeRoute = (key: string) => {
    const remaining = manualAllocations.filter((item) => item.key !== key);
    if (remaining.length === 0) return;
    const removed = manualAllocations.find((item) => item.key === key)?.bps ?? 0;
    const largest = remaining.reduce((best, item) => item.bps > best.bps ? item : best, remaining[0]);
    onAllocationsChange(remaining.map((item) => item.key === largest.key ? { ...item, bps: item.bps + removed } : item));
  };

  // SDK quotes include display-ready token/fee metadata, so they can render on
  // the first quote without waiting for a second pool-detail lookup. HTTP routes
  // still fall back to the shared pool lookup and keep the skeleton until ready.
  if (needsPoolLookup && !isReady) {
    if (hasError) return null;
    return (
      <div className="mt-2 pt-2 border-t border-border/50">
        <div className="text-xs font-medium text-cheese mb-2">Multiroute</div>
        <div className="h-6 rounded bg-secondary/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-cheese">Multiroute</div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant={!manualMode ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={onResetAuto}>Auto</Button>
          <Button type="button" size="sm" variant={manualMode ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={onEnableManual} disabled={!canUseManual}>Manual</Button>
        </div>
      </div>
      {manualMode && (
        <div className="mb-3 space-y-2 border-b border-border/50 pb-3">
          {manualAllocations.map((allocation) => {
            const candidate = candidates.find((item) => item.key === allocation.key);
            if (!candidate) return (
              <div key={allocation.key} className="text-xs text-destructive">Selected route unavailable</div>
            );
            return (
              <div key={allocation.key} className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <VenueLogo venue={candidate.venue} className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{candidateLabel(candidate)}</span>
                  <input
                    aria-label={`${candidateLabel(candidate)} percentage`}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={allocation.bps / 100}
                    onChange={(event) => onAllocationsChange(redistributeAllocations(manualAllocations, allocation.key, Number(event.target.value) * 100))}
                    className="h-7 w-16 rounded-md border border-input bg-background px-2 text-right text-xs text-foreground"
                  />
                  <span className="text-muted-foreground">%</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRoute(allocation.key)} disabled={manualAllocations.length === 1} aria-label={`Remove ${candidateLabel(candidate)}`}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Slider
                  aria-label={`${candidateLabel(candidate)} allocation`}
                  min={0}
                  max={100}
                  step={1}
                  value={[allocation.bps / 100]}
                  onValueChange={([value]) => onAllocationsChange(redistributeAllocations(manualAllocations, allocation.key, value * 100))}
                />
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <Select onValueChange={addRoute} disabled={addable.length === 0 || manualAllocations.length >= 6}>
              <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Add a pool route" /></SelectTrigger>
              <SelectContent>
                {addable.map((candidate) => <SelectItem key={candidate.key} value={candidate.key}>{candidateLabel(candidate)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onResetAuto}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
          {manualAllocations.length < 6 && addable.length > 0 && <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Plus className="h-3 w-3" /> Add up to six routes</div>}
        </div>
      )}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-white font-medium">
              {Math.round(row.split.percent)}%
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  <VenueLogo venue={row.split.venue ?? "alcor"} className="h-4 w-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {VENUE_NAMES[row.split.venue ?? "alcor"]}
              </TooltipContent>
            </Tooltip>
            {/* Start-token chip */}
            <div className="ring-1 ring-border/50 rounded-full">
              <TokenLogo contract={tokenIn.contract} symbol={tokenIn.ticker} size="md" />
            </div>
            <span
              aria-hidden
              className="flex-1 min-w-[12px] border-t border-dashed border-white/60"
            />
            {row.hopFees.map((fee, idx) => {
              const a = row.chain[idx];
              const b = row.chain[idx + 1];
              const isLast = idx === row.hopFees.length - 1;
              if (!a || !b) return null;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center cursor-help">
                          <TokenLogo contract={a.contract} symbol={a.symbol} size="md" />
                          <div className="-ml-3 ring-2 ring-background rounded-full">
                            <TokenLogo contract={b.contract} symbol={b.symbol} size="md" />
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {`${a.symbol} (${a.contract}) / ${b.symbol} (${b.contract})`}
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-white font-medium">
                      {!row.broken ? formatFee(fee) : ""}
                    </span>
                  </div>

                  {!isLast && (
                    <span
                      aria-hidden
                      className="flex-1 min-w-[16px] border-t border-dashed border-white"
                    />
                  )}
                </div>
              );
            })}
            {/* End-token chip */}
            <span
              aria-hidden
              className="flex-1 min-w-[12px] border-t border-dashed border-white/60"
            />
            <div className="ring-1 ring-border/50 rounded-full">
              <TokenLogo contract={tokenOut.contract} symbol={tokenOut.ticker} size="md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}