import { describe, expect, it } from 'vitest';
import { generateKey, MEMO_MAX_BYTES, splitMessage } from '@/lib/cheeseCrypt';
import { buildCg2Actions, collectInvites, encodeAdmission, encodeGroupText, encodeInvite, encodeMemberAdd, encodePolicySnapshot, encodeRoomPolicy, MAX_MEMBERSHIP_PARTS, parseCg2, rosterDigest, saveInvites, loadInvites, scopedKeys, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';
import { decodeConversations, groupMessageCost } from '@/lib/cryptGroups';
import { deriveModeration } from '@/lib/cryptModeration';
import { encodeListing, parseRoomMemo } from '@/lib/cryptRooms';

const owner = generateKey('owner'), me = generateKey('member');
const people = Array.from({ length: 49 }, (_, i) => ({ account: `user${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + i % 26)}`, publicKey: generateKey('peer').publicKey }));
const group: InviteGroup = { id: '0123456789abcdef', name: 'Room', creator: owner.account, created: 1, members: [owner, me].map(k => ({ account: k.account, publicKey: k.publicKey })) };
const event = (payload: string, txId = 'admit', time = 2): Cg2Event => {
  const control = parseCg2(payload);
  if (!control) throw new Error('invalid fixture');
  return { key: txId + payload, txId, time, from: owner.account, to: me.account, usedKey: owner.publicKey, control };
};

describe('public room capacity', () => {
  it('keeps private groups at eight and rejects nine', () => {
    expect(parseCg2(encodeInvite({ ...group, members: [owner, ...people.slice(0, 7)] }))).not.toBeNull();
    expect(() => encodeInvite({ ...group, members: [owner, ...people.slice(0, 8)] })).toThrow();
  });
  it('supports complete 50-member public bootstraps but rejects 51', () => {
    const large = { ...group, members: [owner, me, ...people.slice(0, 48)] };
    const payload = encodeAdmission(large);
    expect(parseCg2(payload)?.kind).toBe('admission');
    expect(() => encodeAdmission({ ...large, members: [...large.members, people[48]] })).toThrow();
    const actions = buildCg2Actions(owner, [me.account], { [me.account]: me.publicKey }, payload, []);
    const rows = actions.filter(a => a.data.to === me.account).map(a => ({ ...a.data, txId: 'admit', time: 2 }));
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.length).toBeLessThanOrEqual(MAX_MEMBERSHIP_PARTS);
    expect(rows.every(r => new TextEncoder().encode(r.memo).length <= MEMO_MAX_BYTES)).toBe(true);
    const decode = (r: typeof rows) => decodeConversations(r, me, { owner: owner.publicKey }).flatMap(m => m.control && m.usedKey ? [{ ...m, control: m.control, usedKey: m.usedKey }] : []);
    const policy = event(encodePolicySnapshot(group.id, ['owner'], [], []));
    const rooms = { [group.id]: { creator: 'owner', publicKey: owner.publicKey } };
    expect(collectInvites([...decode(rows.slice(1)), policy], 'member', me.publicKey, {}, {}, rooms)).toEqual({});
    const admitted = collectInvites([...decode(rows), policy], 'member', me.publicKey, {}, {}, rooms);
    expect(admitted[group.id].members).toHaveLength(50);
    saveInvites('member', admitted);
    expect(loadInvites('member')[group.id].members).toHaveLength(50);
    expect(parseRoomMemo(encodeListing({ id: group.id, name: 'Room', topic: '', tags: [], publicKey: owner.publicKey, members: 50 }))).not.toBeNull();
  });
  it('requires owner-authenticated public policy and a matching predecessor; replays are idempotent', () => {
    const next = people[0];
    const delta = event(encodeMemberAdd(group, next));
    const policy = event(encodeRoomPolicy(group.id, true, ['owner', 'member']));
    const collect = (events: Cg2Event[]) => collectInvites(events, 'member', me.publicKey, {}, { [group.id]: group });
    expect(collect([delta])[group.id].members).toHaveLength(2);
    expect(collect([{ ...delta, usedKey: people[1].publicKey }, policy])[group.id].members).toHaveLength(2);
    expect(collect([delta, delta, policy])[group.id].members).toHaveLength(3);
    const grown = { ...group, members: [...group.members, next] };
    const second = event(encodeMemberAdd(grown, people[1]), 'next', 1);
    expect(collect([second, event(encodeRoomPolicy(group.id, true, ['owner', 'member']), 'next', 1), delta, policy])[group.id].members).toHaveLength(4);
    expect(collect([delta, event(encodeMemberAdd(group, people[1])), policy])[group.id].members).toHaveLength(2);
    expect(rosterDigest(grown)).not.toBe(rosterDigest(group));
    expect(deriveModeration([delta, policy], { [group.id]: grown }, 'member')[group.id].protected).toEqual(['owner', 'member']);
  });
  it('keeps the platform fee fixed for five and 50 members', () => {
    for (const count of [4, 49]) {
      const recipients = people.slice(0, count);
      const actions = buildCg2Actions(owner, recipients.map(p => p.account), Object.fromEntries(recipients.map(p => [p.account, p.publicKey])), encodeGroupText(group.id, 'hello'), []);
      expect(actions.filter(a => a.data.to === 'eosio.null').map(a => a.data.quantity)).toEqual(['0.0080 CHEESE']);
      expect(actions.filter(a => a.data.to === 'xcheeseliqst').map(a => a.data.quantity)).toEqual(['0.0020 CHEESE']);
      expect(actions.filter(a => recipients.some(p => p.account === a.data.to)).every(a => a.data.quantity === '0.0001 CHEESE')).toBe(true);
    }
    expect(groupMessageCost(1, 4)).toBe('0.0104 CHEESE');
    expect(groupMessageCost(1, 49)).toBe('0.0149 CHEESE');
  });
  it('rejects additions authorized by a policy which drops a protected member', () => {
    const privateEight = { ...group, members: [...group.members, ...people.slice(0, 6)] };
    const delta = event(encodeMemberAdd(privateEight, people[6]));
    const invalid = event(encodeRoomPolicy(group.id, true, ['owner', 'member']));
    expect(collectInvites([delta, invalid], 'member', me.publicKey, {}, { [group.id]: privateEight })[group.id].members).toHaveLength(8);
  });
  it('rejects admission paired with an unusable moderation snapshot', () => {
    const admission = event(encodeAdmission(group));
    const invalid = event(encodePolicySnapshot(group.id, ['member'], [], []));
    expect(collectInvites([admission, invalid], 'member', me.publicKey, {}, {}, { [group.id]: { creator: 'owner', publicKey: owner.publicKey } })).toEqual({});
  });
  it('does not lose traffic when a peer key belongs to two groups, or expose their DMs', () => {
    const other = { ...group, id: 'fedcba9876543210' };
    const actions = buildCg2Actions(owner, ['member'], { member: me.publicKey }, encodeGroupText(other.id, 'second group'), []);
    const rows = actions.filter(a => a.data.to === 'member').map(a => ({ ...a.data, txId: 'msg', time: 3 }));
    const decoded = decodeConversations(rows, me, {}, 4, scopedKeys({ [group.id]: group, [other.id]: other }, 'member'));
    expect(decoded.map(m => m.text)).toEqual(['second group']);
  });
});