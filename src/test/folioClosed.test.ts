import { describe, expect, it } from 'vitest';
import { buildHoldings } from '@/lib/folio/holdings';
import { creationIndexed, hasCoverageGap } from '@/lib/folio/scanner';
import type { TokenPosition } from '@/lib/folio/types';

const pos = (key: string, qty: number, realizedWax: number): TokenPosition => ({
  key, contract: key.split(':')[0], symbol: key.split(':')[1], precision: 4, qty, costWax: 0, realizedWax,
  costUsd: 0, realizedUsd: 0, usdGap: false, onOrderQty: 0, inLiquidityQty: 0, inLiquidityCostWax: 0,
  inLiquidityCostUsd: 0, freeQty: 0, boughtQty: 0, soldQty: 0, historyGap: false, unpricedBuys: false,
});

describe('CHEESEFolio closed positions', () => {
  const positions = new Map([['ibc.wt.eos:EOS', pos('ibc.wt.eos:EOS', 0, 2385.54)], ['x:DUST', pos('x:DUST', 0, 0)]]);
  it('hides fully sold tokens by default', () => {
    expect(buildHoldings(positions, [], () => null)).toHaveLength(0);
  });
  it('shows fully sold tokens with realised profit when asked', () => {
    const rows = buildHoldings(positions, [], () => null, 0, null, true);
    expect(rows.map((r) => [r.key, r.closed, r.realizedWax])).toEqual([['ibc.wt.eos:EOS', true, 2385.54]]);
  });
});

describe('CHEESEFolio creation coverage', () => {
  it('treats a node holding the creation transaction as reaching day one', () => {
    expect(creationIndexed({ trx_id: '79cad0', block_num: 27651640 })).toBe(true);
    expect(creationIndexed({ trx_id: '', block_num: 0 })).toBe(false);
  });
  it('still flags a real gap', () => {
    expect(hasCoverageGap(Date.parse('2019-12-10'), Date.parse('2019-12-02'))).toBe(true);
  });
});
