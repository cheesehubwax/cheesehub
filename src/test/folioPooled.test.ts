import { describe, expect, it } from 'vitest';
import { buildHoldings } from '@/lib/folio/holdings';
import { positionRawAmounts, shareAmounts, type PooledToken } from '@/lib/folio/pooled';
import type { TokenPosition } from '@/lib/folio/types';

const pos = (o: Partial<TokenPosition>): TokenPosition => ({
  key: 'cheeseburger:CHEESE', contract: 'cheeseburger', symbol: 'CHEESE', precision: 4,
  qty: 0, costWax: 0, realizedWax: 0, costUsd: 0, realizedUsd: 0, usdGap: false, onOrderQty: 0,
  inLiquidityQty: 0, inLiquidityCostWax: 0, inLiquidityCostUsd: 0, freeQty: 0, boughtQty: 0, soldQty: 0,
  historyGap: false, unpricedBuys: false, ...o,
});
const pooledCheese = (qty: number) => ({
  failed: [] as string[],
  tokens: new Map<string, PooledToken>([['cheeseburger:CHEESE', { key: 'cheeseburger:CHEESE', contract: 'cheeseburger', symbol: 'CHEESE', precision: 4, qty, parts: [{ venue: 'alcor', pair: 'CHEESE / WAX', qty }] }]]),
});
const live = [{ key: 'cheeseburger:CHEESE', contract: 'cheeseburger', symbol: 'CHEESE', precision: 4, balance: 100 }];

describe('CHEESEFolio pooled tokens', () => {
  it('adds pool amounts to the wallet balance and costs them with deposits', () => {
    const p = pos({ qty: 100, costWax: 50, inLiquidityQty: 200, inLiquidityCostWax: 100 });
    const [row] = buildHoldings(new Map([[p.key, p]]), live, () => 1, 0, pooledCheese(300));
    expect(row.balance).toBe(400);
    expect(row.walletBalance).toBe(100);
    expect(row.pooledBalance).toBe(300);
    expect(row.complete).toBe(true);
    expect(row.unrealizedWax).toBe(400 - 150);
  });

  it('hides P/L when a pool venue failed and history says tokens are in pools', () => {
    const p = pos({ qty: 100, costWax: 50, inLiquidityQty: 200, inLiquidityCostWax: 100 });
    const [row] = buildHoldings(new Map([[p.key, p]]), live, () => 1, 0, { failed: ['alcor'], tokens: new Map() });
    expect(row.balance).toBe(100);
    expect(row.complete).toBe(false);
    expect(row.unrealizedWax).toBeNull();
  });

  it('lists a token held only in pools', () => {
    const p = pos({ inLiquidityQty: 10, inLiquidityCostWax: 5 });
    const rows = buildHoldings(new Map([[p.key, p]]), [], () => 1, 0, pooledCheese(10));
    expect(rows).toHaveLength(1);
    expect(rows[0].walletBalance).toBe(0);
    expect(rows[0].complete).toBe(true);
  });

  it('a position below its range is all token A, above it all token B', () => {
    const below = positionRawAmounts(1000, 100, 200, String(2 ** 64))!; // price tick 0
    expect(below.rawB).toBe(0);
    expect(below.rawA).toBeGreaterThan(0);
    const above = positionRawAmounts(1000, -200, -100, String(2 ** 64))!;
    expect(above.rawA).toBe(0);
  });

  it('share tokens give a pro-rata slice of reserves', () => {
    const out = new Map<string, PooledToken>();
    shareAmounts([{ contract: 'swap.taco', symbol: 'CHELSW', balance: 25 }], [{
      venue: 'taco', shareSymbol: 'CHELSW', shareContract: 'swap.taco', totalShares: 100,
      symbolA: 'CHEESE', contractA: 'cheeseburger', reserveA: 1000, precisionA: 4,
      symbolB: 'LSWAX', contractB: 'token.fusion', reserveB: 40, precisionB: 8,
    }], 'taco', out);
    expect(out.get('cheeseburger:CHEESE')!.qty).toBe(250);
    expect(out.get('token.fusion:LSWAX')!.qty).toBe(10);
  });
});
