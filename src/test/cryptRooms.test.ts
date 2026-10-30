import { describe, expect, it } from 'vitest';
import { encryptMemo, generateKey, splitMessage, type ChainMemo, type MessagingKey } from '@/lib/cheeseCrypt';
import { decodeConversations, groupMessageCost } from '@/lib/cryptGroups';
import { buildCg2Actions, JOIN_NOTE_MAX, encodeAdmission, collectInvites, encodeInvite, encodeNotice, parseCg2, partsOf, scopedKeys, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';
import {
  JOIN_REQUEST_COST, LISTING_STAKE_QUANTITY, roomRequestNotes, buildJoinRequestActions, buildRoomActions, collectJoinRequests, encodeJoinMemo, joinMemoKey, collectListings, decodeRoomEvents, encodeListing, encodeUnlist, listedRoomIds, parseRoomMemo, searchListings,
} from '@/lib/cryptRooms';

const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol'), dave = generateKey('dave');
const ID = '00112233445566ff';
const pk = (k: MessagingKey) => ({ account: k.account, publicKey: k.publicKey });
const room = { id: ID, name: 'Cheese club', topic: 'All things cheese', tags: ['cheese', 'wax'], publicKey: alice.publicKey, members: 2 };
const nullLeg = (from: string, memo: string, time: number, quantity = '0.0080 CHEESE'): ChainMemo => ({ txId: `t${time}`, time, from, to: 'eosio.null', memo, quantity });
const stakeLeg = (from: string, memo: string, time: number): ChainMemo => nullLeg(from, memo, time, '8.0000 CHEESE');

let tx = 0;
const memos = (text: string, from: MessagingKey, to: MessagingKey, time: number): ChainMemo[] => {
  const txId = `tx${++tx}`;
  return splitMessage(text).map(p => ({ txId, time, from: from.account, to: to.account, quantity: '0.0001 CHEESE', memo: encryptMemo(p, to.publicKey, from.secretKey) }));
};
const events = (entries: ReturnType<typeof decodeConversations>): Cg2Event[] =>
  entries.flatMap(c => c.control && c.usedKey && !c.voice ? [{ key: c.key, txId: c.txId, time: c.time, from: c.from, to: c.to, control: c.control, usedKey: c.usedKey }] : []);

describe('room listing memos', () => {
  it('round-trips and fits one 256-byte memo even at the longest limits', () => {
    expect(parseRoomMemo(encodeListing(room))).toEqual({ kind: 'list', listing: room });
    const longest = encodeListing({ ...room, name: 'n'.repeat(32), topic: 't'.repeat(56), tags: ['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc'], members: 50 });
    expect(new TextEncoder().encode(longest).length).toBeLessThanOrEqual(256);
    expect(parseRoomMemo(encodeUnlist(ID))).toEqual({ kind: 'unlist', id: ID });
  });
  it('rejects bad keys, 51 members, a fourth tag and over-long text', () => {
    expect(() => encodeListing({ ...room, publicKey: 'short' })).toThrow();
    expect(() => encodeListing({ ...room, members: 51 })).toThrow();
    expect(() => encodeListing({ ...room, tags: ['a', 'b', 'c', 'd'] })).toThrow();
    expect(() => encodeListing({ ...room, name: '🧀'.repeat(32), topic: '🧀'.repeat(56) })).toThrow(/too long/);
    expect(parseRoomMemo('CRYPTROOM1:{"i":"zz"}')).toBeNull();
  });
});

describe('room fee', () => {
  it('updates and unlists pay 0.0080 CHEESE to eosio.null and 0.0020 CHEESE to xcheeseliqst, both carrying the memo', () => {
    const memo = encodeListing(room);
    const actions = buildRoomActions('alice', memo, []);
    expect(actions.map(a => [a.data.to, a.data.quantity, a.data.memo])).toEqual([
      ['eosio.null', '0.0080 CHEESE', memo], ['xcheeseliqst', '0.0020 CHEESE', memo],
    ]);
  });
  it('a new public listing pays the 10.0000 CHEESE stake: 8.0000 to eosio.null and 2.0000 to xcheeseliqst', () => {
    expect(LISTING_STAKE_QUANTITY).toBe('10.0000 CHEESE');
    const memo = encodeListing(room);
    const actions = buildRoomActions('alice', memo, [], LISTING_STAKE_QUANTITY);
    expect(actions.map(a => [a.data.to, a.data.quantity, a.data.memo])).toEqual([
      ['eosio.null', '8.0000 CHEESE', memo], ['xcheeseliqst', '2.0000 CHEESE', memo],
    ]);
  });
  it('a join request pays the ordinary 0.0101 CHEESE with no owner surcharge', () => {
    const payload = encodeNotice('join', ID);
    expect(partsOf(payload)).toBe(1);
    expect(groupMessageCost(1, 1)).toBe('0.0101 CHEESE');
    const actions = buildJoinRequestActions(bob, 'alice', alice.publicKey, ID, []) as { data: { to: string; quantity: string; memo: string } }[];
    expect(actions.map(a => [a.data.to, a.data.quantity])).toEqual([['alice', '0.0001 CHEESE'], ['eosio.null', '0.0080 CHEESE'], ['xcheeseliqst', '0.0020 CHEESE']]);
    expect(actions.some(a => a.data.memo === 'CHEESECrypt join request fee')).toBe(false);
    expect(JOIN_REQUEST_COST).toBe('0.0101 CHEESE');
  });
});

describe('collecting listings', () => {
  it('newest memo per creator and room wins, unlist hides it, unpaid or spoofed legs are ignored', () => {
    const other = { ...room, id: 'ffeeddccbbaa0011', name: 'Wax art' };
    const rows = [
      stakeLeg('alice', encodeListing(room), 10),
      nullLeg('alice', encodeUnlist(ID), 20),
      stakeLeg('carol', encodeListing({ ...other, publicKey: carol.publicKey }), 30),
      nullLeg('dave', encodeListing({ ...room, publicKey: dave.publicKey }), 40, '0.0001 CHEESE'),
      { ...nullLeg('dave', encodeListing({ ...room, publicKey: dave.publicKey }), 41), to: 'xcheeseliqst' },
      nullLeg('dave', encodeListing({ ...room, publicKey: dave.publicKey }), 42, '0.0080 WAX'),
    ];
    const out = collectListings(rows);
    expect(out.map(l => [l.creator, l.name])).toEqual([['carol', 'Wax art']]);
    expect(collectListings([...rows, stakeLeg('alice', encodeListing(room), 50)]).map(l => l.creator)).toEqual(['alice', 'carol']);
  });
  it('a listing without the 10 CHEESE stake never appears; a 0.01 memo only updates a staked listing', () => {
    // Old-style cheap listing on its own: ignored.
    expect(collectListings([nullLeg('alice', encodeListing(room), 10)])).toEqual([]);
    // Stake, then a cheap update refreshes the details and bumps the time.
    const out = collectListings([
      stakeLeg('alice', encodeListing(room), 10),
      nullLeg('alice', encodeListing({ ...room, topic: 'New topic', members: 3 }), 20),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].topic).toBe('New topic');
    expect(out[0].time).toBe(20);
    // Unlisting clears the stake, so a later cheap listing no longer counts.
    expect(collectListings([
      stakeLeg('alice', encodeListing(room), 10),
      nullLeg('alice', encodeUnlist(ID), 30),
      nullLeg('alice', encodeListing(room), 40),
    ])).toEqual([]);
  });
  it('searches name, topic, #tags and creator', () => {
    const l = collectListings([stakeLeg('alice', encodeListing(room), 10)]);
    expect(searchListings(l, '#wax')).toHaveLength(1);
    expect(searchListings(l, 'cheese alice')).toHaveLength(1);
    expect(searchListings(l, 'nfts')).toHaveLength(0);
  });
  it('a local list/unlist action wins until a newer chain memo arrives', () => {
    const l = collectListings([stakeLeg('alice', encodeListing(room), 10)]);
    expect([...listedRoomIds('alice', l, [ID], {})]).toEqual([ID]);
    expect([...listedRoomIds('alice', l, [ID], { [ID]: { listed: false, at: 11 } })]).toEqual([]);
    expect([...listedRoomIds('alice', l, [ID], { [ID]: { listed: false, at: 9 } })]).toEqual([ID]);
    expect([...listedRoomIds('alice', l, [], {})]).toEqual([]);
  });
});

describe('asking to join and being added', () => {
  const invite: InviteGroup = { id: ID, name: 'Cheese club', creator: 'alice', created: 1000, members: [pk(alice), pk(bob)] };
  const grown: InviteGroup = { ...invite, members: [pk(alice), pk(bob), pk(carol)] };

  it('the creator reads a stranger\'s join request with their published key and lists it once', () => {
    const chain = [...memos(encodeNotice('join', ID), carol, alice, 10), ...memos(encodeNotice('join', ID), carol, alice, 12)];
    const ev = decodeRoomEvents(chain, alice, { carol: carol.publicKey });
    expect(ev.map(e => e.control.kind)).toEqual(['join', 'join']);
    const reqs = collectJoinRequests(ev, 'alice', new Set([ID]), { [ID]: ['alice', 'bob'] }, [], {});
    expect(reqs).toEqual([{ groupId: ID, from: 'carol', publicKey: carol.publicKey, time: 12 }]);
    expect(collectJoinRequests(ev, 'alice', new Set(), { [ID]: ['alice', 'bob'] }, [], {})).toEqual([]);
    expect(collectJoinRequests(ev, 'alice', new Set([ID]), { [ID]: ['alice', 'bob'] }, ['carol'], {})).toEqual([]);
    expect(collectJoinRequests(ev, 'alice', new Set([ID]), { [ID]: ['alice', 'bob'] }, [], { [`${ID}:carol`]: 12 })).toEqual([]);
    expect(collectJoinRequests(ev, 'alice', new Set([ID]), { [ID]: ['alice', 'bob', 'carol'] }, [], {})).toEqual([]);
  });

  it('an unpublished requester is read from the key inside their join request', () => {
    const memo = encodeJoinMemo(carol, ID, alice.publicKey);
    expect(new TextEncoder().encode(memo).length).toBeLessThanOrEqual(256);
    expect(joinMemoKey(memo)).toBe(carol.publicKey);
    const ev = decodeRoomEvents([{ txId: 'j', time: 15, from: 'carol', to: 'alice', quantity: '0.0001 CHEESE', memo }], alice, {});
    expect(collectJoinRequests(ev, 'alice', new Set([ID]), { [ID]: ['alice', 'bob'] }, [], {})).toEqual([{ groupId: ID, from: 'carol', publicKey: carol.publicKey, time: 15 }]);
    const actions = buildJoinRequestActions(carol, 'alice', alice.publicKey, ID, []) as { data: { to: string; quantity: string } }[];
    expect(actions.map(a => [a.data.to, a.data.quantity])).toEqual([['alice', '0.0001 CHEESE'], ['eosio.null', '0.0080 CHEESE'], ['xcheeseliqst', '0.0020 CHEESE']]);
  });

  it('a key inside a memo never opens anything but a join request', () => {
    const asJoin = (text: string) => ({ txId: 'x', time: 16, from: 'carol', to: 'alice', quantity: '0.0001 CHEESE', memo: `${encryptMemo(text, alice.publicKey, carol.secretKey)}:${carol.publicKey}` });
    expect(decodeRoomEvents([asJoin('hello stranger')], alice, {})).toEqual([]);
    expect(decodeRoomEvents([asJoin(encodeNotice('friend', ID))], alice, {})).toEqual([]);
    expect(decodeRoomEvents([asJoin(encodeNotice('joined', ID))], alice, {})).toEqual([]);
    // A claimed key the sender does not own cannot open the request.
    const forged = { ...asJoin(encodeNotice('join', ID)), memo: `${encryptMemo(encodeNotice('join', ID), alice.publicKey, carol.secretKey)}:${dave.publicKey}` };
    expect(decodeRoomEvents([forged], alice, {})).toEqual([]);
  });

  it('plain text from a requester never comes out of the room decoding path', () => {
    expect(decodeRoomEvents(memos('hello stranger', carol, alice, 10), alice, { carol: carol.publicKey })).toEqual([]);
  });

  it('the requester accepts the grown invite only from the listing creator and key they asked', () => {
    const chain = memos(encodeInvite(grown), alice, carol, 20);
    const ev = decodeRoomEvents(chain, carol, { alice: alice.publicKey });
    const req = { [ID]: { creator: 'alice', publicKey: alice.publicKey } };
    expect(Object.keys(collectInvites(ev, 'carol', carol.publicKey, {}, {}, req))).toEqual([ID]);
    expect(collectInvites(ev, 'carol', carol.publicKey, {}, {}, {})).toEqual({});
    expect(collectInvites(ev, 'carol', carol.publicKey, {}, {}, { [ID]: { creator: 'alice', publicKey: dave.publicKey } })).toEqual({});
  });

  it('an existing member applies the grown invite (even via the group key) but never a removal or key swap', () => {
    // bob knows alice only through the group: the grown invite opens with alice's scoped key.
    const stored = { [ID]: invite };
    const scoped = scopedKeys(stored, 'bob');
    const ev = (g: InviteGroup, from = alice, time = 30) => events(decodeConversations(memos(encodeInvite(g), from, bob, time), bob, {}, 0, scoped));
    expect(collectInvites(ev(grown), 'bob', bob.publicKey, {}, stored)[ID].members.map(m => m.account)).toEqual(['alice', 'bob', 'carol']);
    const swapped: InviteGroup = { ...invite, members: [{ account: 'alice', publicKey: dave.publicKey }, pk(bob), pk(carol)] };
    expect(collectInvites(ev(swapped), 'bob', bob.publicKey, {}, stored)[ID]).toEqual(invite);
    const renamed: InviteGroup = { ...grown, name: 'Other' };
    expect(collectInvites(ev(renamed), 'bob', bob.publicKey, {}, stored)[ID]).toEqual(invite);
    const notCreator: InviteGroup = { ...grown, creator: 'alice' };
    // A member other than the creator cannot grow the group.
    const fromCarol = events(decodeConversations(memos(encodeInvite(notCreator), carol, bob, 31), bob, {}, 0, scopedKeys({ [ID]: grown }, 'bob')));
    expect(collectInvites(fromCarol, 'bob', bob.publicKey, {}, stored)[ID]).toEqual(invite);
  });

  it('a group key still never opens a new, unknown group invite', () => {
    const other: InviteGroup = { ...grown, id: 'ffffffffffffffff' };
    const entries = decodeConversations(memos(encodeInvite(other), alice, bob, 40), bob, {}, 0, scopedKeys({ [ID]: invite }, 'bob'));
    expect(entries.some(e => e.control)).toBe(false);
    expect(parseCg2(encodeInvite(other))?.kind).toBe('invite');
  });
});

describe('join notes', () => {
  it('a 60-character note rides inside the single 256-byte join request and reaches the owner', () => {
    const note = 'x'.repeat(JOIN_NOTE_MAX);
    expect(JOIN_NOTE_MAX).toBe(60);
    const memo = encodeJoinMemo(carol, ID, alice.publicKey, `  ${note} `);
    expect(new TextEncoder().encode(memo).length).toBeLessThanOrEqual(256);
    const ev = decodeRoomEvents([{ txId: 'n', time: 20, from: 'carol', to: 'alice', quantity: '0.0001 CHEESE', memo }], alice, {});
    expect(collectJoinRequests(ev, 'alice', new Set([ID]), { [ID]: ['alice', 'bob'] }, [], {})[0].note).toBe(note);
  });
  it('rejects notes over 60 characters, multi-line notes, and keeps blank notes off the wire', () => {
    expect(() => encodeNotice('join', ID, 'x'.repeat(61))).toThrow();
    expect(() => encodeNotice('join-no', ID, 'a\nb')).toThrow();
    expect(encodeNotice('join', ID, '   ')).toBe(encodeNotice('join', ID));
    expect(parseCg2(encodeNotice('join-no', ID, 'Sorry mate'))).toEqual({ kind: 'join-no', id: ID, note: 'Sorry mate' });
  });
  it('the requester sees the owner note on a decline and on an acceptance', () => {
    const g: InviteGroup = { id: ID, name: 'Cheese club', creator: 'alice', created: 1, members: [pk(alice), pk(carol)], publicRoom: true };
    const adm = parseCg2(encodeAdmission(g, "You're in!"));
    expect(adm).toMatchObject({ kind: 'admission', note: "You're in!" });
    const req = { [ID]: { id: ID, creator: 'alice', publicKey: alice.publicKey, time: 100 } };
    const ev = (control: Cg2Event['control'], time: number): Cg2Event => ({ key: `k${time}`, txId: `t${time}`, time, from: 'alice', to: 'carol', control, usedKey: alice.publicKey });
    expect(roomRequestNotes(req, [ev(adm!, 200)], 'carol', { [ID]: 'accepted' })).toEqual({ [ID]: "You're in!" });
    expect(roomRequestNotes(req, [ev(parseCg2(encodeNotice('join-no', ID, 'Sorry mate'))!, 200)], 'carol', { [ID]: 'declined' })).toEqual({ [ID]: 'Sorry mate' });
    expect(roomRequestNotes(req, [ev(parseCg2(encodeNotice('join-no', ID))!, 200)], 'carol', { [ID]: 'declined' })).toEqual({});
  });
});
