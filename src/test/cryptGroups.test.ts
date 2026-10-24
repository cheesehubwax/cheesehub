import { describe, expect, it } from 'vitest';
import { generateKey, decryptMemo, messageCost, MSG_PREFIX } from '@/lib/cheeseCrypt';
import { buildGroupMessageActions, createGroup, decodeConversations, groupMessageCost, groupMessageSize, parseGroup } from '@/lib/cryptGroups';

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
  it('charges one split platform fee and two recipient payments for a three-person group', () => {
    const actions = buildGroupMessageActions(alice, group, 'hello', contacts, []);
    expect(actions).toHaveLength(4);
    expect(actions.map(a => a.data.quantity)).toEqual(['0.0001 CHEESE', '0.0080 CHEESE', '0.0020 CHEESE', '0.0001 CHEESE']);
    expect(groupMessageCost(groupMessageSize(group, 'hello').parts, 2)).toBe('0.0102 CHEESE');
    expect(messageCost(1)).toBe('0.0101 CHEESE');
  });
  it.each([[4, '0.0104 CHEESE'], [5, '0.0105 CHEESE']])('charges one shared fee with %i recipients', (count, expected) => {
    const friends = ['bob', 'carol', 'dave', 'eve', 'frank'].slice(0, count);
    const keys = Object.fromEntries(friends.map(name => [name, generateKey(name).publicKey]));
    const actions = buildGroupMessageActions(alice, createGroup('alice', friends), 'hello', keys, []);
    expect(actions.filter(a => a.data.to === 'eosio.null')).toHaveLength(1);
    expect(actions.filter(a => friends.includes(a.data.to)).map(a => a.data.to)).toEqual(friends);
    expect(actions.reduce((sum, a) => sum + Math.round(parseFloat(a.data.quantity) * 10000), 0)).toBe(count + 100);
    expect(groupMessageCost(1, count)).toBe(expected);
  });
  it('charges the shared fee once per multipart part, not per recipient copy', () => {
    const text = '🧀'.repeat(200);
    const parts = groupMessageSize(group, text).parts;
    const actions = buildGroupMessageActions(alice, group, text, contacts, []);
    expect(parts).toBeGreaterThan(1);
    expect(actions.filter(a => a.data.to === 'eosio.null').map(a => a.data.quantity)).toEqual(Array(parts).fill('0.0080 CHEESE'));
    expect(actions.filter(a => a.data.to === 'xcheeseliqst').map(a => a.data.quantity)).toEqual(Array(parts).fill('0.0020 CHEESE'));
    expect(actions.filter(a => a.data.to === 'bob')).toHaveLength(parts);
    expect(actions.filter(a => a.data.to === 'carol')).toHaveLength(parts);
    expect(actions.reduce((sum, a) => sum + Math.round(parseFloat(a.data.quantity) * 10000), 0)).toBe(parts * 102);
    expect(groupMessageCost(parts, 2)).toBe(`${(parts * 0.0102).toFixed(4)} CHEESE`);
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
describe('NFT message pricing', () => {
  it('direct NFT message costs 0.0201 CHEESE with a split 0.0200 platform fee', async () => {
    const { buildSendMessageActions } = await import('@/lib/cheeseCrypt');
    const a = buildSendMessageActions('alice.wam', 'bob.wam', ['m'], [], true);
    expect(a.map(x => x.data.quantity)).toEqual(['0.0001 CHEESE', '0.0160 CHEESE', '0.0040 CHEESE']);
    expect(messageCost(1, true)).toBe('0.0201 CHEESE');
  });
  it('group NFT message splits 0.0200 once plus 0.0010 per recipient', () => {
    const actions = buildGroupMessageActions(alice, group, '[nft:1099512345678]', contacts, [], true);
    expect(actions.filter(a => a.data.to === 'eosio.null').map(a => a.data.quantity)).toEqual(['0.0160 CHEESE']);
    expect(actions.filter(a => a.data.to === 'xcheeseliqst').map(a => a.data.quantity)).toEqual(['0.0040 CHEESE']);
    expect(actions.filter(a => contacts[a.data.to]).map(a => a.data.quantity)).toEqual(['0.0001 CHEESE', '0.0001 CHEESE']);
    expect(groupMessageCost(1, 2, true)).toBe('0.0202 CHEESE');
    expect(groupMessageCost(1, 5, true)).toBe('0.0205 CHEESE');
  });
});
