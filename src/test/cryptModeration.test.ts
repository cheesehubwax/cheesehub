import { beforeEach, describe, expect, it } from 'vitest';
import { generateKey } from '@/lib/cheeseCrypt';
import { encodeModeration, encodeRoomPolicy, MUTE_MINUTES, parseCg2, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';
import { deriveModeration, loadModerationMemos, moderateMessages, mutedUntil, restrictedAt, saveModerationMemos } from '@/lib/cryptModeration';
import type { ConversationEntry } from '@/lib/cryptGroups';
import { applyEdits, editTarget, encodeEdit } from '@/lib/cryptEdits';
import { encodeReply, parseReply } from '@/lib/cryptReply';

const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol');
const id = '0123456789abcdef';
const g: InviteGroup = { id, name: 'room', created: 1, creator: 'alice', members: [alice, bob, carol].map(k => ({ account: k.account, publicKey: k.publicKey })) };
const event = (payload: string, time: number, from = 'alice'): Cg2Event => {
  const control = parseCg2(payload);
  if (!control) throw new Error('Bad test control');
  return { key: `${time}`, txId: `${time}`, time, from, to: 'bob', usedKey: from === 'alice' ? alice.publicKey : carol.publicKey, control };
};
const policy = event(encodeRoomPolicy(id, true, ['alice', 'bob']), 1000);
const row = (time: number, text = 'hidden', from = 'carol'): ConversationEntry => ({ key: `${time}`, txId: `${time}`, time, text, from, to: 'bob', group: null, igroup: id, parts: 1, missing: 0 });
beforeEach(() => localStorage.clear());
describe('public-room moderation rules', () => {
  it('offers exactly 15m, 1hr, 6hrs and 24hrs', () => expect(MUTE_MINUTES).toEqual([15, 60, 360, 1440]));
  it.each([15, 60, 360, 1440] as const)('mutes for exactly %s minutes and never restores muted-period messages', minutes => {
    const states = deriveModeration([policy, event(encodeModeration(id, 'carol', minutes), 2000)], { [id]: g }, 'bob');
    const end = 2000 + minutes * 60_000;
    expect(restrictedAt(states[id], 'carol', 1999)).toBe(false);
    expect(restrictedAt(states[id], 'carol', end - 1)).toBe(true);
    expect(restrictedAt(states[id], 'carol', end)).toBe(false);
    expect(mutedUntil(states[id], 'carol', end + 1)).toBe(0);
    expect(moderateMessages([row(1999), row(2001), row(end - 1), row(end)], states).map(m => m.time)).toEqual([1999, end]);
  });
  it('pre-public members are immune to bans but can be muted', () => {
    const states = deriveModeration([policy, event(encodeModeration(id, 'bob'), 2000), event(encodeModeration(id, 'bob', 15), 3000)], { [id]: g }, 'bob');
    expect(states[id].bans.bob).toBeUndefined();
    expect(restrictedAt(states[id], 'bob', 3001)).toBe(true);
  });
  it('removes later members and preserves earlier history', () => {
    const states = deriveModeration([policy, event(encodeModeration(id, 'carol'), 2000)], { [id]: g }, 'bob');
    expect(moderateMessages([row(1999), row(2000), row(9000000)], states).map(m => m.time)).toEqual([1999]);
  });
  it('unlisting/relisting cannot remove original ban immunity', () => {
    const states = deriveModeration([policy, event(encodeRoomPolicy(id, false, ['alice', 'bob']), 2000), event(encodeRoomPolicy(id, true, ['alice']), 3000), event(encodeModeration(id, 'bob'), 4000)], { [id]: g }, 'bob');
    expect(states[id].protected).toEqual(['alice', 'bob']);
    expect(states[id].bans.bob).toBeUndefined();
    expect(states[id].listed).toBe(false);
  });
  it('ignores non-owner and wrong-key controls and private-room moderation', () => {
    const wrongKey = { ...event(encodeModeration(id, 'bob', 15), 2000), usedKey: carol.publicKey };
    const states = deriveModeration([policy, wrongKey, event(encodeModeration(id, 'bob', 15), 3000, 'carol'), event(encodeRoomPolicy(id, false, ['alice', 'bob']), 4000), event(encodeModeration(id, 'bob', 15), 5000)], { [id]: g }, 'bob');
    expect(states[id].mutes).toEqual({});
  });
  it('cannot omit members present in the pre-public invite', () => {
    const initial: Cg2Event = { ...policy, time: 999, control: { kind: 'invite', invite: g }, txId: 'initial' };
    expect(deriveModeration([initial, policy], { [id]: g }, 'bob')).toEqual({});
  });
  it('strips hidden quotes and ignores edits sent during a mute without touching DMs', () => {
    const states = deriveModeration([policy, event(encodeModeration(id, 'carol', 15), 2000)], { [id]: g }, 'bob');
    const original = row(1500, 'before');
    const edit = row(2500, encodeEdit(editTarget(original), 'muted edit'));
    expect(applyEdits(moderateMessages([original, edit], states)).messages[0].text).toBe('before');
    const reply = row(1000000, encodeReply({ author: 'carol', time: 2500, quote: 'hidden content' }, 'reply'), 'alice');
    expect(parseReply(moderateMessages([reply], states)[0].text)?.quote).toBe('');
    expect(moderateMessages([{ ...row(2500), igroup: undefined }], states)).toHaveLength(1);
  });
  it('retains encrypted controls separately for each account', () => {
    const memos = [{ from: 'alice', to: 'bob', txId: 'control', time: 2000, memo: 'CRYPT1:ciphertext', quantity: '0.0010 CHEESE' }];
    saveModerationMemos('bob', memos);
    expect(loadModerationMemos('bob')).toEqual(memos);
    expect(loadModerationMemos('carol')).toEqual([]);
  });
});