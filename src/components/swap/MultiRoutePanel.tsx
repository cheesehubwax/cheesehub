import { useMemo } from "react";
import { TokenLogo } from "@/components/TokenLogo";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useAlcorPools } from "@/hooks/useAlcorPools";
import type { SwapRoute, SwapToken, AlcorPoolToken } from "@/lib/swapApi";




interface MultiRoutePanelProps {
  route: SwapRoute;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
}

function hasVisualRoute(split: SwapRoute["swaps"][number]): boolean {
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

export function MultiRoutePanel({ route, tokenIn, tokenOut }: MultiRoutePanelProps) {
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
      <div className="text-xs font-medium text-cheese mb-2">Multiroute</div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-white font-medium">
              {Math.round(row.split.percent)}%
            </span>
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