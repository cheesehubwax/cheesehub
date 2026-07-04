import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
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

  if (hasError) return null;

  if (isLoading) {
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
            <span className="text-muted-foreground font-medium min-w-[36px]">
              {Math.round(row.split.percent)}%
            </span>
            {row.chain.map((tok, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <TokenLogo contract={tok.contract} symbol={tok.symbol} size="sm" />
                {idx < row.chain.length - 1 && !row.broken && (
                  <>
                    <span className="text-muted-foreground">
                      {formatFee(row.hopFees[idx])}
                    </span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}