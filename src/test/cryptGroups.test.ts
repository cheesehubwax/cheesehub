import { describe, expect, it } from 'vitest';
import { generateKey, decryptMemo, messageCost, MSG_PREFIX } from '@/lib/cheeseCrypt';
import { buildGroupMessageActions, createGroup, decodeConversations, groupMessageSize, parseGroup } from '@/lib/cryptGroups';

const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol'), eve = generateKey('eve');
const group = createGroup('alice', ['bob', 'carol']);
const contacts = { bob: bob.publicKey, carol: carol.publicKey };
const history = (text: string) => buildGroupMessageActions(alice, group, text, contacts, []).filter(a => a.data.memo.startsWith(MSG_PREFIX)).map(a => ({
  txId: 'tx', time: 1, ...a.data,
}));

describe('ad-hoc group messages', () => {
  it('allows 2–5 friends and rejects duplicates or fewer friends', () => {
    expect(createGroup('alice', ['bob', 'carol']).members).toEqual(['alice', 'bob', 'carol']);
    expect(createGroup('alice', ['bob', 'carol', 'dave', 'eve', 'frank']).members).toHaveLength(6);
    expect(() => createGroup('alice', ['bob'])).toThrow();
    expect(() => createGroup('alice', ['bob', 'bob'])).toThrow();
    expect(() => createGroup('alice', ['bob', 'carol', 'dave', 'eve', 'frank', 'grace'])).toThrow();
  });
  it('charges the existing fee for each recipient copy', () => {
    const actions = buildGroupMessageActions(alice, group, 'hello', contacts, []);
    expect(actions).toHaveLength(4);
    expect(actions.map(a => a.data.quantity)).toEqual(['0.0010 CHEESE', '0.0100 CHEESE', '0.0010 CHEESE', '0.0100 CHEESE']);
    expect(messageCost(groupMessageSize(group, 'hello').parts * 2)).toBe('0.0220 CHEESE');
  });
  it('discovers the same participants for both recipients and shows one sender message', () => {
    const rows = history('hello group');
    for (const recipient of [bob, carol]) {
      const decoded = decodeConversations(rows, recipient, { alice: alice.publicKey });
      expect(decoded).toHaveLength(1);
      expect(decoded[0].text).toBe('hello group');
      expect(decoded[0].group).toEqual(group);
    }
    expect(decodeConversations(rows, alice, contacts)).toHaveLength(1);
    expect(decryptMemo(rows[0].memo, alice.publicKey, eve.secretKey)).toBeNull();
  });
  it('reassembles long copies separately and collapses sender fanout', () => {
    const text = '🧀'.repeat(200);
    const rows = history(text).reverse();
    for (const recipient of [alice, bob, carol]) {
      const decoded = decodeConversations(rows, recipient, { ...contacts, alice: alice.publicKey });
      expect(decoded).toHaveLength(1);
      expect(decoded[0].text).toBe(text);
      expect(decoded[0].missing).toBe(0);
    }
  });
  it('refuses sending without all keys or as a nonmember', () => {
    expect(() => buildGroupMessageActions(alice, group, 'hi', { bob: bob.publicKey }, [])).toThrow();
    expect(() => buildGroupMessageActions(eve, group, 'hi', contacts, [])).toThrow();
  });
  it('does not discover incomplete or malformed group definitions', () => {
    expect(parseGroup({ id: group.id, members: ['alice', 'bob', '<script>'] })).toBeNull();
    const rows = history('x'.repeat(500)).filter(r => r.to === 'bob');
    expect(decodeConversations(rows.slice(1), bob, { alice: alice.publicKey }).some(m => m.group)).toBe(false);
  });
});