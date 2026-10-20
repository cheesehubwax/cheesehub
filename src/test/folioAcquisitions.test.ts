import { describe, expect, it } from 'vitest';
import { acquisitionBreakdown, giftReceipts } from '@/components/folio/FolioParts';
import { buildLedger } from '@/lib/folio/ledger';
import type { FolioEvent } from '@/lib/folio/types';

const token = { key: 'token:TEST', contract: 'token', symbol: 'TEST', precision: 4 };
const wax = { key: 'eosio.token:WAX', contract: 'eosio.token', symbol: 'WAX', precision: 8 };
const events: FolioEvent[] = [
  { id: 'buy', trx: 'buy', ts: 0, seq: 1, type: 'trade', out: [{ ...wax, amount: 100 }], in: [{ ...token, amount: 25 }] },
  { id: 'gift', trx: 'gift', ts: 1, seq: 2, type: 'received', out: [], in: [{ ...token, amount: 50 }], counterparty: 'friendacct12' },
  { id: 'reward', trx: 'reward', ts: 2, seq: 3, type: 'reward', out: [], in: [{ ...token, amount: 25 }], counterparty: 'reward.alcor' },
  { id: 'sent', trx: 'sent', ts: 3, seq: 4, type: 'sent', out: [{ ...token, amount: 20 }], in: [] },
];

describe('CHEESEFolio acquisition breakdown', () => {
  it('splits receipts into purchased, reward (from reward.alcor) and gifted', () => {
    const p = buildLedger(events).positions.get(token.key);
    expect(p).toBeDefined();
    if (!p) throw new Error('Missing test position');
    expect(acquisitionBreakdown(token.key, events, p.freeQty)).toEqual({ purchased: 25, reward: 25, gifted: 50, purchasedPct: 25, rewardPct: 25, giftedPct: 50 });
    expect(p.qty).toBe(80);
    expect(p.costWax / p.qty).toBe(1);
  });
  it('counts rewards from other senders as gifted', () => {
    const farmReward: FolioEvent = { id: 'farm', trx: 'farm', ts: 4, seq: 5, type: 'reward', out: [], in: [{ ...token, amount: 10 }], counterparty: 'farms.waxdao' };
    const p = buildLedger([...events, farmReward]).positions.get(token.key)!;
    expect(acquisitionBreakdown(token.key, [...events, farmReward], p.freeQty)).toMatchObject({ purchased: 25, reward: 25, gifted: 60 });
  });
  it('includes WAX received from trades, even though ledger boughtQty tracks non-WAX', () => {
    const sell: FolioEvent = { id: 'sell', trx: 'sell', ts: 4, seq: 5, type: 'trade', out: [{ ...token, amount: 10 }], in: [{ ...wax, amount: 40 }] };
    expect(acquisitionBreakdown(wax.key, [...events, sell], 10)).toEqual({ purchased: 40, reward: 0, gifted: 10, purchasedPct: 80, rewardPct: 0, giftedPct: 20 });
  });
  it('does not invent percentages without recorded acquisitions', () => {
    expect(acquisitionBreakdown(token.key, [], 0)).toEqual({ purchased: 0, reward: 0, gifted: 0, purchasedPct: null, rewardPct: null, giftedPct: null });
  });
});

describe('CHEESEFolio gift receipts list', () => {
  it('lists direct gifts with sender and amount, excluding reward.alcor rewards and purchases', () => {
    const list = giftReceipts(token.key, events);
    expect(list).toHaveLength(1);
    expect(list[0].e.counterparty).toBe('friendacct12');
    expect(list[0].amount).toBe(50);
  });
  it('includes rewards from other senders as gifts, newest first', () => {
    const farmReward: FolioEvent = { id: 'farm', trx: 'farm', ts: 4, seq: 5, type: 'reward', out: [], in: [{ ...token, amount: 10 }], counterparty: 'farms.waxdao' };
    const list = giftReceipts(token.key, [...events, farmReward]);
    expect(list.map((x) => x.amount)).toEqual([10, 50]);
  });
  it('ignores receipts of other tokens', () => {
    expect(giftReceipts(wax.key, events)).toHaveLength(0);
  });
});
