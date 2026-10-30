import { describe, expect, it } from 'vitest';
import { holdingTotals, type HoldingRow } from '@/lib/folio/holdings';

const row = (key: string, o: Partial<HoldingRow>): HoldingRow => ({
  key, contract: key.split(':')[0], symbol: key.split(':')[1], precision: 4, balance: 10, walletBalance: 10, pooledBalance: 0,
  pooledParts: [], pooledUnknown: false, priceWax: null, valueWax: null, avgCostWax: null, unrealizedWax: null, unrealizedPct: null,
  realizedWax: 0, valueUsd: null, avgCostUsd: null, unrealizedUsd: null, costWax: null, costUsd: null, unrealizedPctUsd: null,
  realizedUsd: 0, usdComplete: true, complete: true, position: null, closed: false, ...o,
});
const WAX = row('eosio.token:WAX', { balance: 100, priceWax: 1, valueWax: 100, valueUsd: 5 });
const CHEESE = row('cheeseburger:CHEESE', { priceWax: 2, valueWax: 20, valueUsd: 1, unrealizedWax: 4, unrealizedUsd: 0.2 });
const UNPRICED = row('x.token:NOPE', {});

describe('CHEESEFolio totals never count unknown as zero', () => {
  it('everything priced: full totals, not partial', () => {
    const t = holdingTotals([WAX, CHEESE], new Map([[CHEESE.key, { wax: 18 }]]));
    expect(t).toMatchObject({ value: 120, valuePartial: false, valueUsd: 6, unrealized: 4, unrealizedPartial: false, realisableWax: 118 });
  });
  it('an unpriced token marks Paper Value and Unrealised P/L partial and leaves Realisable Now unknown', () => {
    const t = holdingTotals([WAX, CHEESE, UNPRICED], new Map([[CHEESE.key, { wax: 18 }]]));
    expect(t.value).toBe(120);
    expect(t.valuePartial).toBe(true);
    expect(t.unrealizedPartial).toBe(true);
    expect(t.realisableWax).toBeNull();
  });
  it('no WAX/USD rate gives an unknown dollar value, not $0', () => {
    const t = holdingTotals([{ ...WAX, valueUsd: null }, { ...CHEESE, valueUsd: null, unrealizedUsd: null }], null);
    expect(t.valueUsd).toBeNull();
    expect(t.unrealizedUsd).toBeNull();
  });
  it('closed tokens are ignored by holding totals', () => {
    const t = holdingTotals([WAX, { ...UNPRICED, closed: true, balance: 0 }], new Map());
    expect(t.valuePartial).toBe(false);
    expect(t.realisableWax).toBe(100);
  });
});
