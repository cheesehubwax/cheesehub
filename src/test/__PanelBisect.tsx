import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { TokenLogo } from "@/components/TokenLogo";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useAlcorPools } from "@/hooks/useAlcorPools";
import type { SwapRoute, SwapToken, AlcorPoolToken, SwapRouteCandidate, SwapSplit } from "@/lib/swapApi";
import { VenueLogo } from "@/components/anal/VenueLogo";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { redistributeAllocations, stepAllocation, type ManualAllocation } from "@/lib/manualSwap";




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

// Compact logo chain for the "Add a pool route" popup, mirroring the route
// rows: start chip, dashed link, overlapped pair logos with fees per hop.
function CandidateRoutePath({ path, hopFees }: { path: AlcorPoolToken[]; hopFees: number[] }) {
  if (path.length < 2) return null;
  const hops = Math.min(hopFees.length, path.length - 1);
  return (
    <>
      <div className="ring-1 ring-border/50 rounded-full shrink-0">
        <TokenLogo contract={path[0].contract} symbol={path[0].symbol} size="sm" />
      </div>
      {Array.from({ length: hops }, (_, idx) => {
        const a = path[idx];
        const b = path[idx + 1];
        if (!a || !b) return null;
        return (
          <div key={idx} className="flex shrink-0 items-center gap-1">
            <span aria-hidden className="w-2 border-t border-dashed border-foreground/60" />
            <div className="flex items-center">
              <TokenLogo contract={a.contract} symbol={a.symbol} size="sm" />
              <div className="-ml-2 ring-2 ring-popover rounded-full">
                <TokenLogo contract={b.contract} symbol={b.symbol} size="sm" />
              </div>
            </div>
            {hopFees[idx] != null && (
              <span className="text-[10px] text-muted-foreground">{formatFee(hopFees[idx])}</span>
            )}
          </div>
        );
      })}
      {hops < path.length - 1 && (
        <>
          <span aria-hidden className="w-2 border-t border-dashed border-foreground/60" />
          <div className="ring-1 ring-border/50 rounded-full shrink-0">
            <TokenLogo contract={path[path.length - 1].contract} symbol={path[path.length - 1].symbol} size="sm" />
          </div>
        </>
      )}
    </>
  );
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

export function MultiRoutePanelBisect({
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
  const [draftAllocations, setDraftAllocations] = useState(manualAllocations);

  useEffect(() => {
    setDraftAllocations(manualAllocations);
  }, [manualAllocations]);

  const displaySplits = useMemo(() => {
    if (!manualMode) return route.swaps;
    return draftAllocations.flatMap((allocation): SwapSplit[] => {
      const quoted = route.swaps.find((split) => split.routeKey === allocation.key);
      if (quoted) return [{ ...quoted, percent: allocation.bps / 100 }];
      const candidate = candidates.find((item) => item.key === allocation.key);
      if (!candidate) return [];
      return [{
        percent: allocation.bps / 100,
        route: candidate.route,
        input: "",
        output: "",
        minReceived: "",
        visualPath: candidate.visualPath,
        visualFees: candidate.visualFees,
        venue: candidate.venue,
        contract: candidate.contract,
        venuePoolId: candidate.venuePoolId,
        routeKey: candidate.key,
      }];
    });
  }, [manualMode, route.swaps, draftAllocations, candidates]);

  const allIds = useMemo(() => {
    const ids: number[] = [];
    displaySplits.forEach((s) => {
      if (!hasVisualRoute(s)) s.route.forEach((id) => ids.push(id));
    });
    return ids;
  }, [displaySplits]);

  const { pools, isReady, hasError } = useAlcorPools(allIds);

  const startId = tokenInId(tokenIn);

  const rows = useMemo(() => {
    return displaySplits.map((split) => {
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
  }, [displaySplits, pools, startId, tokenIn.ticker, tokenIn.contract, tokenIn.precision]);

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

  const changeRoute = (key: string, percent: number) => {
    const next = redistributeAllocations(manualAllocations, key, percent * 100);
    onAllocationsChange(next.length > 1 ? next.filter((item) => item.bps > 0) : next);
  };

  const previewRoute = (key: string, percent: number) => {
    setDraftAllocations(redistributeAllocations(draftAllocations, key, percent * 100));
  };

  const stepRoute = (key: string, deltaPercent: number) => {
    const next = stepAllocation(manualAllocations, key, deltaPercent);
    onAllocationsChange(next.length > 1 ? next.filter((item) => item.bps > 0) : next);
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
      <div className="space-y-1.5">
        {rows.map((row, i) => {
          const routeKey = row.split.routeKey;
          const allocation = routeKey ? draftAllocations.find((item) => item.key === routeKey) : undefined;
          const candidate = routeKey ? candidates.find((item) => item.key === routeKey) : undefined;
          const onlyRoute = draftAllocations.length === 1;
          const percent = allocation ? allocation.bps / 100 : row.split.percent;
          return (
          <div key={routeKey ?? i} className="space-y-1 rounded-md border border-border/40 px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px]">
            <span className="text-foreground font-medium">
              {Math.round(percent)}%
            </span>
            <span>VENUE</span>
            {/* Start-token chip */}
            <div className="ring-1 ring-border/50 rounded-full">
              <TokenLogo contract={tokenIn.contract} symbol={tokenIn.ticker} size="sm" />
            </div>
            <span
              aria-hidden
              className="flex-1 min-w-[12px] border-t border-dashed border-foreground/60"
            />
            {row.hopFees.map((fee, idx) => {
              const a = row.chain[idx];
              const b = row.chain[idx + 1];
              const isLast = idx === row.hopFees.length - 1;
              if (!a || !b) return null;
              return (
                 <div key={idx} className="flex min-w-0 items-center gap-1.5">
                   <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center cursor-help">
                           <TokenLogo contract={a.contract} symbol={a.symbol} size="sm" />
                           <div className="-ml-2 ring-2 ring-background rounded-full">
                             <TokenLogo contract={b.contract} symbol={b.symbol} size="sm" />
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {`${a.symbol} (${a.contract}) / ${b.symbol} (${b.contract})`}
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-foreground font-medium">
                      {!row.broken ? formatFee(fee) : ""}
                    </span>
                  </div>

                  {!isLast && (
                    <span
                      aria-hidden
                      className="flex-1 min-w-[16px] border-t border-dashed border-foreground"
                    />
                  )}
                </div>
              );
            })}
            {/* End-token chip */}
            <span
              aria-hidden
              className="flex-1 min-w-[12px] border-t border-dashed border-foreground/60"
            />
            <div className="ring-1 ring-border/50 rounded-full">
               <TokenLogo contract={tokenOut.contract} symbol={tokenOut.ticker} size="sm" />
            </div>
            {manualMode && routeKey && candidate && (
               <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeRoute(routeKey)} disabled={onlyRoute} aria-label={`Remove ${candidateLabel(candidate)}`}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {manualMode && routeKey && allocation && candidate && (
             <div className="flex items-center gap-1.5">
               <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => stepRoute(routeKey, -1)} disabled={onlyRoute || allocation.bps <= 0} aria-label={`Decrease ${candidateLabel(candidate)} by 1%`}>
                 <Minus className="h-3.5 w-3.5" />
              </Button>
              <Slider
                aria-label={`${candidateLabel(candidate)} allocation`}
                min={0}
                max={100}
                step={1}
                value={[percent]}
                disabled={onlyRoute}
                onValueChange={([value]) => previewRoute(routeKey, value)}
                onValueCommit={([value]) => changeRoute(routeKey, value)}
                 className="h-7 min-w-0 flex-1 px-1 [&>span:first-child]:h-2.5 [&>span:last-child]:h-6 [&>span:last-child]:w-6"
              />
               <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => stepRoute(routeKey, 1)} disabled={onlyRoute || allocation.bps >= 10_000} aria-label={`Increase ${candidateLabel(candidate)} by 1%`}>
                 <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          </div>
          );
        })}
      </div>
      {manualMode && (
         <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
          <div className="flex items-center gap-2">
            <Select onValueChange={addRoute} disabled={addable.length === 0 || manualAllocations.length >= 6}>
              <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Add a pool route" /></SelectTrigger>
              <SelectContent>
                {addable.map((candidate) => (
                  <SelectItem key={candidate.key} value={candidate.key} className="pr-2">
                    <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs">
                      <VenueLogo venue={candidate.venue} className="h-3.5 w-3.5 shrink-0" />
                      {candidate.visualPath.length >= 2 ? (
                        <CandidateRoutePath path={candidate.visualPath} hopFees={candidate.visualFees ?? []} />
                      ) : (
                        <span className="text-muted-foreground">{candidateLabel(candidate)}</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onResetAuto}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
          {manualAllocations.length < 6 && addable.length > 0 && <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Plus className="h-3 w-3" /> Add up to six routes</div>}
        </div>
      )}
    </div>
  );
}