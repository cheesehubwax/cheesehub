// Render isolation: rebuilt-but-identical holding rows skip redrawing; changed ones redraw.
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HoldingRow } from '@/lib/folio/holdings';

const draws = new Map<string, number>();
vi.mock('@/components/TokenLogo', () => ({
  TokenLogo: ({ symbol }: { symbol: string }) => {
    draws.set(symbol, (draws.get(symbol) ?? 0) + 1);
    return null;
  },
}));
import { HoldingsTable } from '@/components/folio/HoldingsTable';

const make = (symbol: string, priceWax: number): HoldingRow => ({
  key: `t.${symbol}:${symbol}`, contract: `t.${symbol}`, symbol, precision: 4,
  balance: 100, walletBalance: 100, pooledBalance: 0, pooledParts: [], pooledUnknown: false,
  priceWax, valueWax: 100 * priceWax, avgCostWax: 0.4, unrealizedWax: 1, unrealizedPct: 1,
  realizedWax: 0, valueUsd: 1, avgCostUsd: 0.01, unrealizedUsd: 0.1, unrealizedPctUsd: 1,
  realizedUsd: 0, usdComplete: true, complete: true, position: null, closed: false, costWax: 40, costUsd: 1,
});
const onPick = () => undefined;
const table = (rows: HoldingRow[], cur: 'WAX' | 'USD' = 'WAX') => (
  <HoldingsTable rows={rows} events={[]} waxUsd={0.04} cur={cur} onPick={onPick} />
);

describe('CHEESEFolio holdings render isolation', () => {
  beforeEach(() => { draws.clear(); window.innerWidth = 1024; });

  it('a price tick redraws only the token whose price changed', () => {
    const { rerender } = render(table([make('AAA', 0.5), make('BBB', 0.4), make('CCC', 0.3)]));
    draws.clear();
    rerender(table([make('AAA', 0.5), make('BBB', 0.45), make('CCC', 0.3)]));
    expect(draws.get('AAA')).toBeUndefined();
    expect(draws.get('BBB')).toBe(1);
    expect(draws.get('CCC')).toBeUndefined();
  });

  it('switching currency redraws every row', () => {
    const rows = [make('AAA', 0.5), make('BBB', 0.4)];
    const { rerender } = render(table(rows));
    draws.clear();
    rerender(table(rows, 'USD'));
    expect(draws.get('AAA')).toBe(1);
    expect(draws.get('BBB')).toBe(1);
  });
});
