import { describe, it, expect } from 'vitest';
import { parseTipCommand, encodeTip, parseTip, verifyTip, buildTipTransfer, TIP_MEMO, isTipCommand } from '@/lib/cryptTips';
import { routeCryptActions, buildSendMessageActions, expandRouterActions, generateKey } from '@/lib/cheeseCrypt';
import { buildCg2Actions, encodeGroupText } from '@/lib/cryptInviteGroups';
import { decodeConversations } from '@/lib/cryptGroups';
import { encodeReply, parseReply } from '@/lib/cryptReply';
import { sponsorCryptActions } from '@/lib/cryptSponsor';

type Routed = { account: string; name: string; authorization: unknown; data: { to?: string; quantity?: string; parts?: number; copies?: { to: string; memo: string }[] } };

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
  it('preserves the direct tip beside payment and sendmsg, excluding tip funds from the router', () => {
    const auth = [{ actor: 'alice', permission: 'active' }];
    const actions = [buildTipTransfer('alice', tip, auth), ...buildSendMessageActions('alice', 'bob', 'CRYPT1:x', auth)];
    const routed = routeCryptActions(actions) as Routed[];
    expect(routed).toHaveLength(3);
    expect(routed[0]).toBe(actions[0]);
    expect(routed[0].data).toEqual({ from: 'alice', to: 'bob', quantity: '100.0000 CHEESE', memo: TIP_MEMO });
    expect(routed[1].data).toMatchObject({ to: 'crypt.cheese', quantity: '0.0101 CHEESE' });
    expect(routed[2]).toMatchObject({ account: 'crypt.cheese', name: 'sendmsg', data: { sender: 'alice', parts: 1, copies: [{ to: 'bob', memo: 'CRYPT1:x' }] } });
    expect(sponsorCryptActions(routed, 1_000_000)).toBe(routed);
  });
});

describe('public-room tip delivery regression', () => {
  it('reads the 2 CHEESE tip note and verifies its transfer for the sender and every room recipient', () => {
    const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol');
    const auth = [{ actor: 'alice', permission: 'active' }];
    const tip = { recipient: 'bob', amount: '2.0000', note: 'Thank you for helping!' };
    const id = '00112233445566ff';
    const keys = { alice: alice.publicKey, bob: bob.publicKey, carol: carol.publicKey };
    const body = encodeReply({ author: 'bob', time: 500, quote: 'Welcome' }, encodeTip(tip));
    const messages = buildCg2Actions(alice, ['bob', 'carol'], keys, encodeGroupText(id, body), auth);
    const out = routeCryptActions([buildTipTransfer('alice', tip, auth), ...messages]) as Routed[];
    expect(out).toHaveLength(3);
    expect(out[0].data).toMatchObject({ to: 'bob', quantity: '2.0000 CHEESE' });
    const parts = out[2].data.parts ?? 0;
    expect(parts).toBeGreaterThan(0);
    expect(out[1].data).toMatchObject({ to: 'crypt.cheese', quantity: `${(parts * 102 / 10000).toFixed(4)} CHEESE` });
    expect(out[2].data.copies?.map(c => c.memo)).toEqual(messages.filter(a => a.data.memo.startsWith('CRYPT2:')).map(a => a.data.memo));
    // The only direct token legs are the tip and router payment, not encrypted dust copies.
    expect(out.filter(a => a.account === 'cheeseburger').map(a => a.data.quantity)).toEqual(['2.0000 CHEESE', out[1].data.quantity]);
    const traces = out.map(act => ({ act }));
    const rows = expandRouterActions('tiptx', 1000, traces);
    for (const key of [alice, bob, carol]) {
      const decoded = decodeConversations(rows, key, keys, 2000);
      expect(decoded).toHaveLength(1);
      expect(decoded[0]).toMatchObject({ txId: 'tiptx', from: 'alice', igroup: id, missing: 0 });
      expect(parseTip(parseReply(decoded[0].text)?.body)).toEqual(tip);
      expect(verifyTip(decoded[0].from, tip, traces)).toBe(true);
      expect(verifyTip(decoded[0].from, tip, traces.slice(1))).toBe(false);
    }
  });

  it('keeps invalid tips and malformed message batches out of the router', () => {
    const auth = [{ actor: 'alice', permission: 'active' }];
    const tip = { recipient: 'bob', amount: '2.0000', note: '' };
    const transfer = buildTipTransfer('alice', tip, auth);
    const message = buildSendMessageActions('alice', 'bob', 'CRYPT1:x', auth);
    for (const bad of [
      { ...transfer, data: { ...transfer.data, quantity: '0.0000 CHEESE' } },
      { ...transfer, data: { ...transfer.data, quantity: '2.00000 CHEESE' } },
      { ...transfer, data: { ...transfer.data, to: 'crypt.cheese' } },
      { ...transfer, data: { ...transfer.data, to: 'alice' } },
      { ...transfer, data: { ...transfer.data, memo: 'Other transfer' } },
    ]) {
      const actions = [bad, ...message];
      expect(routeCryptActions(actions)).toBe(actions);
    }
    for (const actions of [
      [transfer], [transfer, transfer, ...message],
      [transfer, ...buildSendMessageActions('alice', 'bob', 'CRYPT1:x', auth, false, false)],
      [transfer, ...message, ...buildSendMessageActions('alice', 'carol', ['CRYPT1:y', 'CRYPT1:z'], auth, false, false)],
      [transfer, ...message].map(a => ({ ...a, authorization: [{ actor: 'mallory', permission: 'active' }] })),
    ]) expect(routeCryptActions(actions)).toBe(actions);
  });
});
