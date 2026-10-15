import { describe, expect, it } from 'vitest';
import { applyAlcorDeals, fillGaveFromDeals, type AlcorMarket } from '@/lib/folio/alcorDeals';
import { txProvidersFor } from '@/lib/folio/scanner';
import { classifyTransfers } from '@/lib/folio/classify';
import { buildLedger } from '@/lib/folio/ledger';
import { realisableGapPct } from '@/lib/folio/holdings';
import type { FolioEvent, RawTransfer } from '@/lib/folio/types';

const markets = new Map<number, AlcorMarket>([
  [992, { id: 992, base_token: { contract: 'eosio.token', symbol: { name: 'WAX', precision: 8 } }, quote_token: { contract: 'cheeseburger', symbol: { name: 'CHEESE', precision: 4 } } }],
]);
const fill = (quantity: string, contract: string): RawTransfer => ({
  gs: 1, trx: 'b226', ts: 0, contract, from: 'alcordexmain', to: 'liquidcheese', quantity, memo: 'order match | DEX | alcor.exchange',
});

describe('CHEESEFolio fills from Alcor deals', () => {
  // Real deal: liquidcheese sold 16.6944 CHEESE and received 24.999864 WAX.
  const deal = { market: 992, trx_id: 'b226', ask: 16.6944, bid: 24.999864, asker: 'liquidcheese', bidder: 'waxpcrawlers' };
  it('gives the other side of the deal in the market\'s other token', () => {
    expect(fillGaveFromDeals([deal], markets, 'liquidcheese', fill('24.99986400 WAX', 'eosio.token'))).toEqual({ contract: 'cheeseburger', quantity: '16.6944 CHEESE' });
  });
  it('returns null when no side equals what was received', () => {
    expect(fillGaveFromDeals([deal], markets, 'liquidcheese', fill('25.00000000 WAX', 'eosio.token'))).toBeNull();
  });
  it('marks only explained fills as checked', () => {
    const a = fill('24.99986400 WAX', 'eosio.token');
    const b = { ...fill('1.00000000 WAX', 'eosio.token'), gs: 2 };
    expect(applyAlcorDeals([a, b], [deal], markets, 'liquidcheese', () => true)).toBe(1);
    expect(a.fillChecked).toBe(true);
    expect(b.fillChecked).toBeUndefined();
  });
});

describe('CHEESEFolio fill lookup routing', () => {
  it('skips providers whose history starts after the fill', () => {
    const ps = [
      { base: 'fast-recent', earliestTs: Date.parse('2026-02-19'), slots: 8 },
      { base: 'slow-full', earliestTs: Date.parse('2024-12-28'), slots: 8 },
    ];
    expect(txProvidersFor(Date.parse('2025-06-01'), ps).map((p) => p.base)).toEqual(['slow-full']);
    expect(txProvidersFor(Date.parse('2026-06-01'), ps).map((p) => p.base)).toEqual(['fast-recent', 'slow-full']);
  });
});

describe('CHEESEFolio Alcor pool fees', () => {
  it('counts "Collected Fee" as a reward, not liquidity coming back', () => {
    const ev = classifyTransfers([{
      gs: 5, trx: 't', ts: 0, contract: 'cheeseburger', from: 'swap.alcor', to: 'me', quantity: '41.0902 CHEESE',
      memo: 'Collected Fee for TokenA - Pool ID #1252 - Position ID #139440',
    }], 'me');
    expect(ev[0].type).toBe('reward');
  });
  it('keeps "Decrease liquidity" as liquidity removal', () => {
    const ev = classifyTransfers([{
      gs: 5, trx: 't', ts: 0, contract: 'cheeseburger', from: 'swap.alcor', to: 'me', quantity: '2337.4281 CHEESE',
      memo: 'Decrease liquidity for TokenA - Pool ID #8025 - Position ID #145475',
    }], 'me');
    expect(ev[0].type).toBe('liquidity-remove');
  });
});

const CHEESE = { key: 'cheeseburger:CHEESE', contract: 'cheeseburger', symbol: 'CHEESE', precision: 4 };
const WAX = { key: 'eosio.token:WAX', contract: 'eosio.token', symbol: 'WAX', precision: 8 };
const trade = (id: string, ts: number, out: FolioEvent['out'], inn: FolioEvent['in'], seq: number): FolioEvent => ({ id, trx: id, ts, seq, type: 'trade', venue: 'alcor', out, in: inn });

describe('CHEESEFolio USD profit/loss', () => {
  const day1 = Date.parse('2026-01-01T12:00:00Z');
  const day2 = Date.parse('2026-02-01T12:00:00Z');
  const rate = (ts: number) => (ts < day2 - 1000 ? 0.05 : 0.02);
  const events = [
    trade('buy', day1, [{ ...WAX, amount: 100 }], [{ ...CHEESE, amount: 100 }], 1),
    trade('sell', day2, [{ ...CHEESE, amount: 100 }], [{ ...WAX, amount: 200 }], 2),
  ];
  it('uses the trade-day WAX/USD rate for cost and proceeds', () => {
    const l = buildLedger(events, () => null, rate);
    const cheese = l.positions.get(CHEESE.key)!;
    expect(cheese.realizedWax).toBeCloseTo(100, 9); // 200 − 100 WAX
    expect(cheese.realizedUsd).toBeCloseTo(-1, 9); // $4 proceeds − $5 cost
    expect(l.valueUsdByEvent.get('buy')).toBeCloseTo(5, 9);
    expect(l.positions.get(WAX.key)!.costUsd).toBeCloseTo(4, 9); // 200 WAX at $0.02
  });
  it('flags tokens traded on days with no USD rate', () => {
    const l = buildLedger(events, () => null, () => null);
    expect(l.positions.get(CHEESE.key)!.usdGap).toBe(true);
  });
});

describe('CHEESEFolio realisable vs paper value', () => {
  it('is the % a full sale returns above or below paper value', () => {
    expect(realisableGapPct(95, 100)).toBeCloseTo(-5, 9);
    expect(realisableGapPct(null, 100)).toBeNull();
    expect(realisableGapPct(50, 0)).toBeNull();
  });
});
