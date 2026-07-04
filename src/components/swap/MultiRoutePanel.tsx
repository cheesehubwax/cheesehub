import { useMemo } from "react";
import { TokenLogo } from "@/components/TokenLogo";
import { useAlcorPools } from "@/hooks/useAlcorPools";
import type { SwapRoute, SwapToken, AlcorPoolToken } from "@/lib/swapApi";

interface MultiRoutePanelProps {
  route: SwapRoute;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
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
    route.swaps.forEach((s) => s.route.forEach((id) => ids.push(id)));
    return ids;
  }, [route.swaps]);

  const { pools, isLoading, hasError } = useAlcorPools(allIds);

  const isWoe = route.source === "woe";

  const startId = tokenInId(tokenIn);

  const rows = useMemo(() => {
    return route.swaps.map((split) => {
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

  if (hasError && !isWoe) return null;

  if (isLoading && !isWoe) {
    return (
      <div className="mt-2 pt-2 border-t border-border/50">
        <div className="text-xs font-medium text-cheese mb-2">Multiroute</div>
        <div className="h-6 rounded bg-secondary/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-cheese">Multiroute</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          via {isWoe ? "WaxOnEdge" : "Alcor"}
        </div>
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-white font-medium">
              {Math.round(row.split.percent)}%
            </span>
            {isWoe && row.hopFees.length === 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center">
                  <TokenLogo contract={tokenIn.contract} symbol={tokenIn.ticker} size="md" />
                  <div className="-ml-3 ring-2 ring-background rounded-full">
                    <TokenLogo contract={tokenOut.contract} symbol={tokenOut.ticker} size="md" />
                  </div>
                </div>
              </div>
            )}
            {row.hopFees.map((fee, idx) => {
              const a = row.chain[idx];
              const b = row.chain[idx + 1];
              const isLast = idx === row.hopFees.length - 1;
              if (!a || !b) return null;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center">
                      <TokenLogo contract={a.contract} symbol={a.symbol} size="md" />
                      <div className="-ml-3 ring-2 ring-background rounded-full">
                        <TokenLogo contract={b.contract} symbol={b.symbol} size="md" />
                      </div>
                    </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}