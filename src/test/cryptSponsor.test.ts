import { describe, it, expect } from 'vitest';
import { buildSendMessageActions, expandSponsoredActions, routeCryptActions } from '@/lib/cheeseCrypt';
import { buildTipTransfer } from '@/lib/cryptTips';
import { isSponsorRejection, parseBudget, sponsorCryptActions, sponsorRemaining, windowStartAt } from '@/lib/cryptSponsor';

const auth = [{ actor: 'alice', permission: 'active' }];
const row = (o: Record<string, unknown> = {}) => ({
  daily_limit: '200.0000 CHEESE', window_start: 1000, spent: '0.0000 CHEESE', sponsor_balance: '500.0000 CHEESE', funder: 'dr.cheese', enabled: 1, ...o,
});

describe('sponsored message budget', () => {
  it('allows at most 200 CHEESE per 24-hour window', () => {
    expect(sponsorRemaining(parseBudget(row()), 2000)).toBe(2_000_000);
    expect(sponsorRemaining(parseBudget(row({ spent: '199.9900 CHEESE' })), 2000)).toBe(100);
    expect(sponsorRemaining(parseBudget(row({ spent: '200.0000 CHEESE' })), 2000)).toBe(0);
  });

  it('opens a fresh window only after a full day', () => {
    const used = parseBudget(row({ spent: '200.0000 CHEESE' }));
    expect(sponsorRemaining(used, 1000 + 86399)).toBe(0);
    expect(sponsorRemaining(used, 1000 + 86400)).toBe(2_000_000);
    expect(windowStartAt(500, 1000)).toBe(1000);
  });

  it('is never more than the funded sponsor balance', () => {
    expect(sponsorRemaining(parseBudget(row({ sponsor_balance: '0.0300 CHEESE' })), 2000)).toBe(300);
  });

  it('is zero when switched off, unfunded or missing', () => {
    expect(sponsorRemaining(parseBudget(row({ enabled: 0 })), 2000)).toBe(0);
    expect(sponsorRemaining(parseBudget(row({ funder: '' })), 2000)).toBe(0);
    expect(sponsorRemaining(parseBudget(undefined), 2000)).toBe(0);
  });
});

describe('free send path', () => {
  const routed = () => routeCryptActions(buildSendMessageActions('alice', 'bob', ['CRYPT1:a', 'CRYPT1:b'], auth)) as Record<string, unknown>[];

  it('sends a covered message as one sendfree action with no token transfer', () => {
    const out = sponsorCryptActions(routed(), 200) as { account: string; name: string; data: any }[];
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ account: 'crypt.cheese', name: 'sendfree', data: { sender: 'alice', parts: 2, copies: [{ to: 'bob', memo: 'CRYPT1:a' }, { to: 'bob', memo: 'CRYPT1:b' }] } });
  });

  it('stays paid when the remaining budget does not cover every part', () => {
    const r = routed();
    expect(sponsorCryptActions(r, 199)).toBe(r);
  });

  it('keeps tips on their own paid path', () => {
    const tip = [buildTipTransfer('alice', { recipient: 'bob', amount: '1.0000', note: '' } as never, auth), ...buildSendMessageActions('alice', 'bob', ['CRYPT1:t'], auth)];
    const r = routeCryptActions(tip) as Record<string, unknown>[];
    expect(sponsorCryptActions(r, 1_000_000)).toBe(r);
  });

  it('recognises the contract budget errors', () => {
    expect(isSponsorRejection('assertion failure with message: free messaging budget reached for today')).toBe(true);
    expect(isSponsorRejection('user rejected')).toBe(false);
  });
});

describe('sponsored history', () => {
  const act = (actor: string, trx = 'tx1') => ({ trx_id: trx, '@timestamp': '2026-11-06T08:00:00.000', act: { account: 'crypt.cheese', name: 'sendfree', authorization: [{ actor, permission: 'active' }], data: { sender: 'alice', parts: 1, copies: [{ to: 'bob', memo: 'CRYPT1:m' }] } } });

  it('attributes copies to the authorizing sender, once per notified account', () => {
    expect(expandSponsoredActions([act('alice'), act('alice')])).toEqual([
      { txId: 'tx1', time: Date.parse('2026-11-06T08:00:00.000Z'), from: 'alice', to: 'bob', memo: 'CRYPT1:m', quantity: '0.0000 CHEESE' },
    ]);
  });

  it('ignores a sendfree whose claimed sender did not authorize it', () => {
    expect(expandSponsoredActions([act('mallory')])).toEqual([]);
  });
});
