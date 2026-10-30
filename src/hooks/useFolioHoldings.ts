// CHEESEFolio holdings for the page: live balances + pool positions + ledger
// → rows, then the summary totals for the visible (portfolio-scoped) rows.
import { useMemo } from 'react';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { usePooledTokens } from '@/hooks/usePooledTokens';
import { useRealisableValues } from '@/hooks/useRealisableValues';
import { buildHoldings, holdingTotals } from '@/lib/folio/holdings';
import { totalHoldingCost } from '@/lib/folio/acquisitions';
import type { LedgerResult, TokenKey } from '@/lib/folio/types';

export function useFolioHoldings(opts: {
  account: string | null;
  ledger: LedgerResult;
  /** Ledger limited to the selected portfolio, for realised totals. */
  scopedLedger: LedgerResult;
  priceMap: Map<TokenKey, number> | undefined;
  /** Display currency per WAX now; 0 while unknown. */
  waxRate: number;
  showClosed: boolean;
  portfolioKeys: Set<TokenKey> | null;
}) {
  const { account, ledger, scopedLedger, priceMap, waxRate, showClosed, portfolioKeys } = opts;
  const { tokens: live, isLoading: liveLoading } = useAllTokenBalances(account ?? undefined);
  const shares = useMemo(
    () => live.filter((t) => t.isLpToken).map((t) => ({ contract: t.contract, symbol: t.symbol, balance: t.balance })),
    [live],
  );
  const { data: pooled, isFetching: pooledLoading } = usePooledTokens(account, shares, !liveLoading);
  const allHoldings = useMemo(
    () =>
      buildHoldings(
        ledger.positions,
        live.filter((t) => !t.isLpToken).map((t) => ({
          key: `${t.contract}:${t.symbol}`, contract: t.contract, symbol: t.symbol, precision: t.precision, balance: t.balance,
        })),
        (key) => priceMap?.get(key) ?? null,
        waxRate,
        pooled ?? null,
        true,
      ),
    [ledger, live, priceMap, waxRate, pooled],
  );
  const holdings = useMemo(
    () => allHoldings.filter((h) => (showClosed || !h.closed) && (!portfolioKeys || portfolioKeys.has(h.key))),
    [allHoldings, showClosed, portfolioKeys],
  );
  const { data: realisable } = useRealisableValues(holdings, account);
  const totalCost = useMemo(() => totalHoldingCost(holdings), [holdings]);
  const totals = useMemo(() => {
    let realized = 0, realizedUsd = 0;
    for (const p of scopedLedger.positions.values()) {
      realized += p.realizedWax;
      realizedUsd += p.realizedUsd;
    }
    return { ...holdingTotals(holdings, realisable), realized, realizedUsd };
  }, [holdings, scopedLedger, realisable]);
  return { allHoldings, holdings, totals, totalCost, realisable, pooled, pooledLoading, liveLoading };
}
