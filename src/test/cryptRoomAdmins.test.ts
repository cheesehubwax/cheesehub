import { describe, expect, it } from 'vitest';
import { generateKey } from '@/lib/cheeseCrypt';
import { encodeAdmin, encodeCollapse, encodeModeration, encodePolicySnapshot, encodeRoomPolicy, parseCg2, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';
import { applyCollapses, collapsedKeys, deriveModeration, restrictedAt, roomRole } from '@/lib/cryptModeration';
import { editTarget } from '@/lib/cryptEdits';
import { encodeReply, parseReply } from '@/lib/cryptReply';
import type { ConversationEntry } from '@/lib/cryptGroups';

const keys = Object.fromEntries(['alice', 'bob', 'carol', 'dave', 'erin'].map(a => [a, generateKey(a)]));
const id = '0123456789abcdef';
// alice owns; bob is a founding member; carol, dave, erin joined after the room went public.
const g: InviteGroup = { id, name: 'room', created: 1, creator: 'alice', members: Object.values(keys).map(k => ({ account: k.account, publicKey: k.publicKey })) };
const ME = 'bob';
const ev = (payload: string, time: number, from = 'alice'): Cg2Event => {
  const control = parseCg2(payload);
  if (!control) throw new Error('bad control');
  return { key: `${time}`, txId: `${time}`, time, from, to: ME, usedKey: keys[from].publicKey, control };
};
const policy = ev(encodeRoomPolicy(id, true, ['alice', 'bob']), 1000);
const appoint = ev(encodeAdmin(id, 'dave', true), 1500);
const derive = (...events: Cg2Event[]) => deriveModeration([policy, ...events], { [id]: g }, ME)[id];
const row = (from: string, time: number, text = `hello from ${from}`): ConversationEntry => ({ key: `${from}${time}`, txId: `t${time}`, time, text, from, to: ME, group: null, igroup: id, parts: 1, missing: 0 });

describe('public-room admins', () => {
  it('only the owner can appoint or dismiss admins', () => {
    expect(derive(appoint).admins).toEqual(['dave']);
    expect(derive(ev(encodeAdmin(id, 'carol', true), 1500, 'dave')).admins).toEqual([]);
    expect(derive(appoint, ev(encodeAdmin(id, 'dave', false), 1600)).admins).toEqual([]);
    expect(roomRole(derive(appoint), g, 'dave', 2000)).toBe('admin');
    expect(roomRole(derive(appoint), g, 'carol', 2000)).toBe('member');
  });
  it('admins can mute founding and regular members but never the owner', () => {
    const s = derive(appoint, ev(encodeModeration(id, 'bob', 15), 2000, 'dave'), ev(encodeModeration(id, 'carol', 60), 2000, 'dave'), ev(encodeModeration(id, 'alice', 15), 2000, 'dave'));
    expect(restrictedAt(s, 'bob', 2001)).toBe(true);
    expect(restrictedAt(s, 'carol', 2001)).toBe(true);
    expect(restrictedAt(s, 'alice', 2001)).toBe(false);
  });
  it('admins cannot ban anyone', () => {
    expect(derive(appoint, ev(encodeModeration(id, 'carol'), 2000, 'dave')).bans).toEqual({});
  });
  it('regular members and dismissed admins cannot moderate', () => {
    expect(derive(ev(encodeModeration(id, 'carol', 15), 2000, 'dave')).mutes).toEqual({});
    expect(derive(appoint, ev(encodeAdmin(id, 'dave', false), 1600), ev(encodeModeration(id, 'carol', 15), 2000, 'dave')).mutes).toEqual({});
  });
  it('admin mutes made before dismissal stay in place', () => {
    const s = derive(appoint, ev(encodeModeration(id, 'carol', 15), 2000, 'dave'), ev(encodeAdmin(id, 'dave', false), 3000));
    expect(restrictedAt(s, 'carol', 3001)).toBe(true);
  });
  it('a removed admin loses the role', () => {
    expect(derive(appoint, ev(encodeModeration(id, 'dave'), 2000)).admins).toEqual([]);
  });
});

describe('collapsing messages', () => {
  const carolMsg = row('carol', 1800), bobMsg = row('bob', 1800), aliceMsg = row('alice', 1800);
  const collapse = (m: ConversationEntry, by: string, at = 2000) => ev(encodeCollapse(id, m.from, editTarget(m)), at, by);
  it('admins collapse post-public members only; never founders or the owner', () => {
    const s = derive(appoint, collapse(carolMsg, 'dave'), collapse(bobMsg, 'dave', 2001), collapse(aliceMsg, 'dave', 2002));
    expect([...collapsedKeys([carolMsg, bobMsg, aliceMsg], { [id]: s }).keys()]).toEqual([carolMsg.key]);
  });
  it('the owner can collapse founding members’ messages', () => {
    const s = derive(collapse(bobMsg, 'alice'));
    expect(collapsedKeys([bobMsg], { [id]: s }).get(bobMsg.key)).toEqual({ by: 'alice', at: 2000 });
  });
  it('regular members cannot collapse, and a collapse cannot target a later message', () => {
    expect(collapsedKeys([carolMsg], { [id]: derive(collapse(carolMsg, 'erin')) }).size).toBe(0);
    const late = { ...carolMsg, time: 5000 };
    expect(collapsedKeys([late], { [id]: derive(ev(encodeCollapse(id, 'carol', editTarget(late)), 2000)) }).size).toBe(0);
  });
  it('collapsed messages are flagged and quotes of them are stripped', () => {
    const s = derive(collapse(carolMsg, 'alice'));
    const reply = row('bob', 3000, encodeReply({ author: 'carol', time: 1800, quote: 'hello from carol' }, 'reply'));
    const out = applyCollapses([carolMsg, reply], collapsedKeys([carolMsg, reply], { [id]: s }));
    expect(out[0].collapsed?.by).toBe('alice');
    expect(parseReply(out[1].text)?.quote).toBe('');
  });
  it('a newcomer bootstrap carries the current admins', () => {
    const invite: Cg2Event = { ...ev(encodeAdmin(id, 'dave', true), 4000), txId: 'join', control: { kind: 'invite', invite: g } };
    const snap = { ...ev(encodePolicySnapshot(id, ['alice', 'bob'], [], [], ['dave']), 4000), txId: 'join' };
    expect(deriveModeration([invite, snap], { [id]: g }, ME)[id].admins).toEqual(['dave']);
  });
});
