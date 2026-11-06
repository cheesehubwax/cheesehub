import { describe, it, expect } from 'vitest';
import { parseTipCommand, encodeTip, parseTip, verifyTip, buildTipTransfer, TIP_MEMO, isTipCommand } from '@/lib/cryptTips';
import { routeCryptActions, buildSendMessageActions } from '@/lib/cheeseCrypt';

const act = (from: string, to: string, quantity: string, memo = TIP_MEMO, actor = from) => ({ act: { account: 'cheeseburger', name: 'transfer', authorization: [{ actor }], data: { from, to, quantity, memo } } });

describe('/tip command', () => {
  it('parses amount, optional "cheese" and note', () => {
    expect(parseTipCommand('/tip 100 cheese great work!')).toEqual({ ok: true, amount: '100.0000', note: 'great work!' });
    expect(parseTipCommand('/TIP 2.5 CHEESE')).toEqual({ ok: true, amount: '2.5000', note: '' });
    expect(parseTipCommand('/tip 0.0001 thanks')).toEqual({ ok: true, amount: '0.0001', note: 'thanks' });
    expect(isTipCommand('/tipping')).toBe(false);
  });
  it('rejects zero, too many decimals and missing amount', () => {
    expect(parseTipCommand('/tip 0 cheese').ok).toBe(false);
    expect(parseTipCommand('/tip 1.00001 cheese').ok).toBe(false);
    expect(parseTipCommand('/tip').ok).toBe(false);
    expect(parseTipCommand('/tip abc').ok).toBe(false);
  });
  it('round-trips the encrypted tip line', () => {
    const t = { recipient: 'bob.chz', amount: '100.0000', note: 'great work!' };
    expect(parseTip(encodeTip(t))).toEqual(t);
  });
});

describe('tip verification', () => {
  const tip = { recipient: 'bob', amount: '100.0000', note: '' };
  it('accepts the matching sender-authorized transfer', () => {
    expect(verifyTip('alice', tip, [act('alice', 'bob', '100.0000 CHEESE')])).toBe(true);
  });
  it('rejects mismatched amount, recipient, sender, memo or authorizer', () => {
    expect(verifyTip('alice', tip, [act('alice', 'bob', '10.0000 CHEESE')])).toBe(false);
    expect(verifyTip('alice', tip, [act('alice', 'carol', '100.0000 CHEESE')])).toBe(false);
    expect(verifyTip('alice', tip, [act('mallory', 'bob', '100.0000 CHEESE')])).toBe(false);
    expect(verifyTip('alice', { ...tip, amount: '0.0001' }, [act('alice', 'bob', '0.0001 CHEESE', 'CRYPT1:abc')])).toBe(false);
    expect(verifyTip('alice', tip, [act('alice', 'bob', '100.0000 CHEESE', TIP_MEMO, 'mallory')])).toBe(false);
  });
  it('tip transactions stay on the direct path, never sending tip funds to crypt.cheese', () => {
    const auth = [{ actor: 'alice', permission: 'active' }];
    const actions = [buildTipTransfer('alice', tip, auth), ...buildSendMessageActions('alice', 'bob', 'CRYPT1:x', auth)];
    const routed = routeCryptActions(actions) as typeof actions;
    expect(routed).toBe(actions);
    expect(routed[0].data).toEqual({ from: 'alice', to: 'bob', quantity: '100.0000 CHEESE', memo: TIP_MEMO });
  });
});
