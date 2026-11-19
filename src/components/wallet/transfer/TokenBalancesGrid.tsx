import { memo } from 'react';
import { ExternalLink } from 'lucide-react';
import { TokenLogo } from '@/components/TokenLogo';
import { explorerAccount } from '@/lib/explorer';
import type { TokenWithBalance } from '@/hooks/useAllTokenBalances';

interface TokenBalancesGridProps {
  hasBalances: boolean;
  sortedBalances: TokenWithBalance[];
  portfolioWax: number;
  portfolioUsd: number;
  waxPrice: number;
  isUsingFallback: boolean;
}

/** Account tab token list: non-WAX portfolio value plus a grid of balances. */
export const TokenBalancesGrid = memo(function TokenBalancesGrid({
  hasBalances,
  sortedBalances,
  portfolioWax,
  portfolioUsd,
  waxPrice,
  isUsingFallback,
}: TokenBalancesGridProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Token Balances</h3>
        {portfolioWax > 0 && (
          <span className="text-sm">
            <span className="font-medium text-primary">
              {portfolioWax.toLocaleString(undefined, { maximumFractionDigits: 4 })} WAX
            </span>
            {waxPrice > 0 && (
              <span className="text-muted-foreground ml-1.5">
                (${portfolioUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })})
              </span>
            )}
          </span>
        )}
      </div>
      {isUsingFallback && (
        <div className="p-2 bg-primary/5 border border-primary/20 rounded-lg text-xs text-primary/70">
          Balance data may be slightly delayed.
        </div>
      )}
      {hasBalances ? (
        <div className="grid grid-cols-4 gap-2">
          {sortedBalances.map((b) => (
            <a
              key={`${b.contract}:${b.symbol}`}
              href={explorerAccount(b.contract)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm hover:bg-muted/50 transition-colors group"
            >
              <TokenLogo contract={b.contract} symbol={b.symbol} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-1">
                  {b.symbol}
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-xs text-cheese truncate">
                  {b.balance.toLocaleString(undefined, {
                    minimumFractionDigits: Math.min(20, Math.max(0, b.precision || 0)),
                    maximumFractionDigits: Math.min(20, Math.max(0, b.precision || 0)),
                  })}
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No token balances found.</p>
      )}
    </div>
  );
});
