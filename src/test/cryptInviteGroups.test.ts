import { describe, expect, it } from 'vitest';
import { encryptMemo, generateKey, splitMessage, type MessagingKey } from '@/lib/cheeseCrypt';
import { decodeConversations, groupPayload } from '@/lib/cryptGroups';
import { withoutBlocked } from '@/lib/cryptBlocklist';
import {
  buildCg2Actions, collectInvites, deriveInviteGroups, encodeGroupText, encodeInvite, encodeMeta, encodeNotice, inviteAcceptable, parseCg2,
  scopedKeys, validateInvite, type Cg2Event, type InviteGroup,
} from '@/lib/cryptInviteGroups';

const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol'), dave = generateKey('dave');
const ID = '00112233445566ff';
const invite: InviteGroup = {
  id: ID, name: 'Cheese club', creator: 'alice', created: 1000,
  members: [alice, bob, carol].map(k => ({ account: k.account, publicKey: k.publicKey })),
};

let tx = 0;
/** Every part of `text` as encrypted memos in one transaction. */
const memos = (text: string, from: MessagingKey, to: MessagingKey, time: number) => {
  const txId = `tx${++tx}`;
  return splitMessage(text).map(p => ({ txId, time, from: from.account, to: to.account, quantity: '0.0001 CHEESE', memo: encryptMemo(p, to.publicKey, from.secretKey) }));
};
const events = (entries: ReturnType<typeof decodeConversations>): Cg2Event[] =>
  entries.flatMap(c => c.control && c.usedKey && !c.voice ? [{ key: c.key, txId: c.txId, time: c.time, from: c.from, to: c.to, control: c.control, usedKey: c.usedKey }] : []);

describe('invite format', () => {
  it('round-trips and keeps member keys', () => {
    const parsed = parseCg2(encodeInvite(invite));
    expect(parsed).toEqual({ kind: 'invite', invite });
  });

  it('allows up to 8 members and rejects 9, a missing creator, duplicates or bad keys', () => {
    const m = (n: number) => Array.from({ length: n }, (_, i) => [`user${'abcdefghi'[i]}`, alice.publicKey]);
    const base = { i: ID, n: 'x', o: 'usera', c: 1 };
    expect(validateInvite({ ...base, m: m(8) })).not.toBeNull();
    expect(validateInvite({ ...base, m: m(9) })).toBeNull();
    expect(validateInvite({ ...base, o: 'nobody', m: m(3) })).toBeNull();
    expect(validateInvite({ ...base, m: [['usera', alice.publicKey], ['usera', bob.publicKey]] })).toBeNull();
    expect(validateInvite({ ...base, m: [['usera', alice.publicKey], ['userb', 'short']] })).toBeNull();
  });
});

describe('who an invite counts from', () => {
  const ev = (over: Partial<Cg2Event>): Cg2Event => ({ key: 'k', txId: 't', time: 1, from: 'alice', to: 'bob', control: { kind: 'invite', invite }, usedKey: alice.publicKey, ...over });
  const bobContacts = { alice: alice.publicKey };

  it('accepts the creator, a friend, sending with the listed key to my real key', () => {
    expect(inviteAcceptable(ev({}), 'bob', bob.publicKey, bobContacts)).toBe(true);
  });
  it('rejects a non-creator sender', () => {
    expect(inviteAcceptable(ev({ from: 'carol', usedKey: carol.publicKey }), 'bob', bob.publicKey, { carol: carol.publicKey })).toBe(false);
  });
  it('rejects a creator who is not my friend', () => {
    expect(inviteAcceptable(ev({}), 'bob', bob.publicKey, {})).toBe(false);
  });
  it('rejects an invite listing a different key for me', () => {
    expect(inviteAcceptable(ev({}), 'bob', dave.publicKey, bobContacts)).toBe(false);
  });
  it('rejects an invite whose creator key differs from my contact key', () => {
    expect(inviteAcceptable(ev({}), 'bob', bob.publicKey, { alice: dave.publicKey })).toBe(false);
  });
});

describe('decoding with group keys', () => {
  it('reads the invite, then group-only keys open that group and nothing else; old groups still read', () => {
    // bob is friends with alice only; carol is introduced by the group.
    const bobContacts = { alice: alice.publicKey };
    const legacy = { id: 'aaaaaaaaaaaaaaaa', members: ['alice', 'bob', 'dave'] };
    const chain = [
      ...memos(encodeInvite(invite), alice, bob, 10),
      ...memos(encodeGroupText(ID, 'hello from carol'), carol, bob, 20),
      ...memos('secret DM from carol', carol, bob, 21),
      ...memos(encodeNotice('joined', 'ffffffffffffffff'), carol, bob, 22),
      ...memos(groupPayload(legacy, 'legacy group text'), alice, bob, 23),
    ];
    const first = decodeConversations(chain, bob, bobContacts, 0);
    const invites = collectInvites(events(first), 'bob', bob.publicKey, bobContacts, {});
    expect(Object.keys(invites)).toEqual([ID]);
    const second = decodeConversations(chain, bob, bobContacts, 0, scopedKeys(invites, 'bob'));
    const texts = second.map(c => c.text);
    expect(texts).toContain('hello from carol');
    expect(texts).toContain('legacy group text');
    expect(texts).not.toContain('secret DM from carol');
    expect(second.find(c => c.text === 'hello from carol')?.igroup).toBe(ID);
    expect(second.some(c => c.control?.kind === 'joined')).toBe(false);
  });

  it('drops a blocked creator before anything is decrypted', () => {
    const chain = withoutBlocked(memos(encodeInvite(invite), alice, bob, 10), 'bob', ['alice']);
    expect(collectInvites(events(decodeConversations(chain, bob, { alice: alice.publicKey }, 0)), 'bob', bob.publicKey, { alice: alice.publicKey }, {})).toEqual({});
  });
});

describe('group state', () => {
  const invites = { [ID]: invite };
  const e = (from: MessagingKey, to: MessagingKey, time: number, control: Cg2Event['control']): Cg2Event => ({ key: `${time}`, txId: `${time}`, time, from: from.account, to: to.account, control, usedKey: (from.account === 'bob' ? to : from).publicKey });

  it('counts joins and leaves by newest notice, and the creator as joined', () => {
    const v = deriveInviteGroups([
      e(carol, bob, 5, { kind: 'joined', id: ID }),
      e(carol, bob, 9, { kind: 'leave', id: ID }),
    ], invites, 'bob', { [ID]: { status: 'joined', at: 3 } })[0];
    expect(v.status).toBe('joined');
    expect(v.joined).toEqual(['alice', 'bob']);
    expect(v.pending).toEqual(['carol']);
  });

  it('starts as invited and ignores notices opened with a key the invite did not list', () => {
    const forged = { ...e(carol, bob, 5, { kind: 'joined', id: ID }), usedKey: dave.publicKey };
    const v = deriveInviteGroups([forged], invites, 'bob', {})[0];
    expect(v.status).toBe('invited');
    expect(v.joined).toEqual(['alice']);
  });

  it('applies only the creator’s newest name/picture change', () => {
    const v = deriveInviteGroups([
      e(alice, bob, 5, { kind: 'meta', id: ID, name: 'Newer' }),
      e(alice, bob, 2, { kind: 'meta', id: ID, name: 'Older' }),
      e(carol, bob, 9, { kind: 'meta', id: ID, name: 'Hijack' }),
    ], invites, 'bob', {})[0];
    expect(v.name).toBe('Newer');
  });

  it('shows a friend request until answered, and an accept back to the requester', () => {
    const toBob = deriveInviteGroups([e(carol, bob, 5, { kind: 'friend', id: ID })], invites, 'bob', {})[0];
    expect(toBob.friendRequests).toEqual(['carol']);
    const carolSide = deriveInviteGroups([
      { ...e(carol, bob, 5, { kind: 'friend', id: ID }), usedKey: bob.publicKey },
      { ...e(bob, carol, 8, { kind: 'friend-ok', id: ID }), usedKey: bob.publicKey },
    ], invites, 'carol', {})[0];
    expect(carolSide.accepted).toEqual(['bob']);
  });

  it('meta encoding requires a name', () => {
    expect(() => encodeMeta(ID, '  ')).toThrow();
  });
});

describe('invite group fees', () => {
  it('one shared platform fee per part split 80/20, plus 0.0001 CHEESE to each of 3 recipients', () => {
    const keys = { bob: bob.publicKey, carol: carol.publicKey, dave: dave.publicKey };
    const actions = buildCg2Actions(alice, ['bob', 'carol', 'dave'], keys, encodeNotice('joined', ID), []) as { data: { to: string; quantity: string } }[];
    expect(actions.map(a => [a.data.to, a.data.quantity])).toEqual([
      ['bob', '0.0001 CHEESE'], ['eosio.null', '0.0080 CHEESE'], ['xcheeseliqst', '0.0020 CHEESE'],
      ['carol', '0.0001 CHEESE'], ['dave', '0.0001 CHEESE'],
    ]);
  });

  it('refuses to send to yourself or without a member key', () => {
    expect(() => buildCg2Actions(alice, ['alice'], { alice: alice.publicKey }, encodeNotice('joined', ID), [])).toThrow();
    expect(() => buildCg2Actions(alice, ['bob'], {}, encodeNotice('joined', ID), [])).toThrow();
  });
});
