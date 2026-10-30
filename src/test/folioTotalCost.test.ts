import { describe, expect, it } from 'vitest';
import { holdingCost, totalHoldingCost } from '@/lib/folio/acquisitions';
import { buildHoldings, type HoldingRow } from '@/lib/folio/holdings';
import type { TokenPosition } from '@/lib/folio/types';

const position: TokenPosition = {
  key: 'cheeseburger:CHEESE', contract: 'cheeseburger', symbol: 'CHEESE', precision: 4,
  qty: 100, costWax: 50, costUsd: 4, realizedWax: 12, realizedUsd: 1,
  inLiquidityQty: 200, inLiquidityCostWax: 100, inLiquidityCostUsd: 6,
  usdGap: false, historyGap: false, unpricedBuys: false, onOrderQty: 0,
  freeQty: 0, boughtQty: 100, soldQty: 0,
};
const rows = () => buildHoldings(new Map([[position.key, position]]), [
  { ...position, balance: 100 },
  { key: 'eosio.token:WAX', contract: 'eosio.token', symbol: 'WAX', precision: 8, balance: 20 },
], () => 1, 0.2, { failed: [], tokens: new Map([[position.key, {
  ...position, qty: 300, parts: [{ venue: 'alcor', pair: 'CHEESE / WAX', qty: 300 }],
}]]) });

describe('portfolio remaining total cost', () => {
  it('uses wallet plus deposited pool cost, not current value or all-time purchases', () => {
    const cheese = rows().filter((r) => r.key === position.key);
    expect(totalHoldingCost(cheese)).toEqual({ wax: 150, usd: 10, partialWax: false, partialUsd: false });
    expect((cheese[0].valueWax ?? 0) - 150).toBe(cheese[0].unrealizedWax);
    expect((cheese[0].valueUsd ?? 0) - 10).toBe(cheese[0].unrealizedUsd);
  });
  it('includes WAX balance at one WAX per unit but does not invent its historical fiat cost', () => {
    expect(totalHoldingCost(rows())).toEqual({ wax: 170, usd: 10, partialWax: false, partialUsd: true });
  });
  it('does not count closed positions or realised profits as remaining cost', () => {
    const closed: HoldingRow = { ...rows()[0], closed: true, balance: 0, avgCostWax: 5, avgCostUsd: 2 };
    expect(totalHoldingCost([closed]).wax).toBe(0);
    expect(totalHoldingCost([closed]).usd).toBe(0);
  });
  it('keeps missing history costs unknown, including when every cost is missing', () => {
    const unknown = { ...rows()[0], avgCostWax: null, avgCostUsd: null, costWax: null, costUsd: null };
    expect(totalHoldingCost([unknown])).toEqual({ wax: null, usd: null, partialWax: true, partialUsd: true });
    expect(totalHoldingCost([rows()[0], unknown])).toEqual({ wax: 150, usd: 10, partialWax: true, partialUsd: true });
  });
  it('counts free holdings as a known zero cost and an empty portfolio as zero', () => {
    expect(totalHoldingCost([{ ...rows()[0], avgCostWax: 0, avgCostUsd: 0, costWax: 0, costUsd: 0 }])).toEqual({ wax: 0, usd: 0, partialWax: false, partialUsd: false });
    expect(totalHoldingCost([])).toEqual({ wax: 0, usd: 0, partialWax: false, partialUsd: false });
  });
});

describe('per-token total cost', () => {
  it('matches the summary: wallet plus pool deposits, WAX at one per unit, closed rows unknown', () => {
    const all = rows();
    const cheese = all.find((r) => r.key === position.key)!;
    const wax = all.find((r) => r.key === 'eosio.token:WAX')!;
    expect(cheese.costWax).toBe(150);
    expect(cheese.costUsd).toBe(10);
    expect(holdingCost(cheese, false)).toBe(150);
    expect(holdingCost(cheese, true)).toBe(10);
    expect(wax.costWax).toBe(20);
    expect(wax.costUsd).toBeNull();
    expect(holdingCost(wax, false)).toBe(20);
    expect(holdingCost({ ...cheese, closed: true, balance: 0 }, false)).toBeNull();
    expect(holdingCost({ ...cheese, costWax: null, costUsd: null }, false)).toBeNull();
  });
});