import { describe, expect, it } from 'vitest';
import { buildLedger } from '@/lib/folio/ledger';
import type { FolioEvent, TokenAmount } from '@/lib/folio/types';

// Golden ledger: hand-checked average-cost numbers that refactors must not change.
const C = { key: 'cheeseburger:CHEESE', contract: 'cheeseburger', symbol: 'CHEESE', precision: 4 };
const W = { key: 'eosio.token:WAX', contract: 'eosio.token', symbol: 'WAX', precision: 8 };
const ev = (id: string, seq: number, type: FolioEvent['type'], out: TokenAmount[], inn: TokenAmount[]): FolioEvent =>
  ({ id, trx: id, ts: seq * 1000, seq, type, venue: 'alcor', out, in: inn }) as FolioEvent;

const buys = [
  ev('b1', 1, 'trade', [{ ...W, amount: 100 }], [{ ...C, amount: 200 }]),
  ev('b2', 2, 'trade', [{ ...W, amount: 300 }], [{ ...C, amount: 200 }]),
  ev('g', 3, 'received', [], [{ ...C, amount: 100 }]),
];
const lpAdd = ev('lp', 4, 'liquidity-add', [{ ...C, amount: 50 }], []);
const lpRemove = ev('lr', 5, 'liquidity-remove', [], [{ ...C, amount: 50 }]);
const sell = ev('s', 6, 'trade', [{ ...C, amount: 250 }], [{ ...W, amount: 500 }]);

describe('CHEESEFolio golden ledger', () => {
  it('400 bought for 400 WAX plus 100 free: selling 250 for 500 WAX realises 300 WAX', () => {
    const l = buildLedger([...buys, lpAdd, lpRemove, sell]);
    const c = l.positions.get(C.key)!;
    expect(c.qty).toBeCloseTo(250, 9);
    expect(c.costWax).toBeCloseTo(200, 9);
    expect(c.realizedWax).toBeCloseTo(300, 9);
    expect(c.boughtQty).toBeCloseTo(400, 9);
    expect(c.freeQty).toBeCloseTo(100, 9);
    expect(c.soldQty).toBeCloseTo(250, 9);
    expect(l.realizedByEvent.get('s')).toBeCloseTo(300, 9);
  });

  it('a pool deposit-and-withdraw round trip leaves holdings and cost unchanged', () => {
    const without = buildLedger([...buys, sell]).positions.get(C.key)!;
    const withLp = buildLedger([...buys, lpAdd, lpRemove, sell]).positions.get(C.key)!;
    expect(withLp.qty).toBeCloseTo(without.qty, 9);
    expect(withLp.costWax).toBeCloseTo(without.costWax, 9);
    expect(withLp.realizedWax).toBeCloseTo(without.realizedWax, 9);
  });

  it('unknown USD rates mark a gap instead of inventing zero-dollar profit', () => {
    const c = buildLedger([...buys, sell]).positions.get(C.key)!;
    expect(c.usdGap).toBe(true);
  });
});
