import { describe, expect, it, beforeEach } from 'vitest';
import { encodeRoomProfiles, parseCg2, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';
import { deriveRoomProfiles, encodeSelfRoomProfile, loadRoomProfiles, mergeRoomProfiles, roomProfileEntries, saveRoomProfiles } from '@/lib/cryptRoomProfiles';
import { MAX_PARTS, partCount } from '@/lib/cheeseCrypt';

const pk = (n: number) => btoa(String.fromCharCode(...new Array(32).fill(n)));
const px = (c: string) => c.repeat(64);
const ID = '0123456789abcdef';
const room: InviteGroup = { id: ID, name: 'cheese', creator: 'dr.cheese', created: 1, publicRoom: true,
  members: [{ account: 'dr.cheese', publicKey: pk(1) }, { account: 'fren1', publicKey: pk(2) }, { account: 'bum.gpk', publicKey: pk(3) }, { account: 'newbie', publicKey: pk(4) }] };
const admission = parseCg2(`\u0002CG2:admission:${JSON.stringify({ i: ID, n: 'cheese', o: 'dr.cheese', c: 1, m: room.members.map(m => [m.account, m.publicKey]) })}`)!;
const ev = (control: Cg2Event['control'], over: Partial<Cg2Event> = {}): Cg2Event =>
  ({ key: Math.random().toString(), txId: 'tx1', time: 100, from: 'dr.cheese', to: 'newbie', control, usedKey: pk(1), ...over });
const directory = () => parseCg2(encodeRoomProfiles(ID, [
  { account: 'dr.cheese', displayName: 'cheeseplum', avatar: { version: 1, pixels: px('a') } },
  { account: 'fren1', displayName: 'Fren' },
  { account: 'outsider', displayName: 'Nope' },
])!)!;

describe('room profile directory', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips names and pictures', () => {
    const c = directory();
    expect(c.kind).toBe('profiles');
    if (c.kind !== 'profiles') return;
    expect(c.entries[0]).toEqual({ account: 'dr.cheese', displayName: 'cheeseplum', avatar: { version: 1, pixels: px('a') } });
    expect(c.entries[1]).toEqual({ account: 'fren1', displayName: 'Fren' });
  });

  it('newcomer sees the owner name and other members from the admission transaction', () => {
    const p = deriveRoomProfiles([ev(admission), ev(directory())], { [ID]: room }, 'newbie');
    expect(p['dr.cheese']).toMatchObject({ displayName: 'cheeseplum', self: true });
    expect(p.fren1).toMatchObject({ displayName: 'Fren', self: false });
    expect(p.outsider).toBeUndefined();
  });

  it('ignores a directory without the owner admission in the same transaction', () => {
    expect(deriveRoomProfiles([ev(admission, { txId: 'other' }), ev(directory())], { [ID]: room }, 'newbie')).toEqual({});
  });

  it('ignores a directory from anyone but the room owner', () => {
    expect(deriveRoomProfiles([ev(admission), ev(directory(), { from: 'fren1', usedKey: pk(2) })], { [ID]: room }, 'newbie')).toEqual({});
    expect(deriveRoomProfiles([ev(admission), ev(directory(), { usedKey: pk(9) })], { [ID]: room }, 'newbie')).toEqual({});
  });

  it('a member describing themself beats the owner, newest wins otherwise', () => {
    const owner = { 'fren1': { displayName: 'Old', time: 50, self: false } };
    expect(mergeRoomProfiles(owner, { fren1: { displayName: 'New', time: 60, self: false } }).fren1.displayName).toBe('New');
    expect(mergeRoomProfiles({ fren1: { displayName: 'Mine', time: 10, self: true } }, owner).fren1.displayName).toBe('Mine');
  });

  it('owner sends itself first and stays within one message size', () => {
    const many: InviteGroup = { ...room, members: Array.from({ length: 50 }, (_, i) => ({ account: i ? `member${'abcdefghijklmnopqrstuvwxy'[i % 25]}${'12345'[i % 5]}` : 'dr.cheese', publicKey: pk(i + 1) })) };
    const avatars = Object.fromEntries(many.members.map(m => [m.account, { version: 1 as const, pixels: px('b') }]));
    const names = Object.fromEntries(many.members.map(m => [m.account, 'A long display name here']));
    const entries = roomProfileEntries(many, { account: 'dr.cheese', displayName: 'cheeseplum' }, names, avatars, {});
    expect(entries[0]).toEqual({ account: 'dr.cheese', displayName: 'cheeseplum' });
    const payload = encodeRoomProfiles(ID, entries)!;
    expect(partCount(payload)).toBeLessThanOrEqual(MAX_PARTS);
    const c = parseCg2(payload);
    expect(c?.kind === 'profiles' && c.entries[0].account).toBe('dr.cheese');
  });

  it('persists per account', () => {
    saveRoomProfiles('newbie', { fren1: { displayName: 'Fren', time: 1, self: false } });
    expect(loadRoomProfiles('newbie').fren1.displayName).toBe('Fren');
    expect(loadRoomProfiles('other')).toEqual({});
  });
});

describe('room profile sync (members sharing their own profile)', () => {
  const self = (account: string, name: string) => parseCg2(encodeSelfRoomProfile(ID, { account, displayName: name })!)!;

  it('a member can send their own name to non-friend members, no admission needed', () => {
    const p = deriveRoomProfiles([ev(self('fren1', 'Fren'), { from: 'fren1', to: 'bum.gpk', usedKey: pk(2), txId: 'tx9' })], { [ID]: room }, 'bum.gpk');
    expect(p.fren1).toMatchObject({ displayName: 'Fren', self: true });
  });

  it('works in private invite groups too', () => {
    const p = deriveRoomProfiles([ev(self('fren1', 'Fren'), { from: 'fren1', to: 'bum.gpk', usedKey: pk(2) })], { [ID]: { ...room, publicRoom: false } }, 'bum.gpk');
    expect(p.fren1?.displayName).toBe('Fren');
  });

  it('a member cannot describe someone else', () => {
    expect(deriveRoomProfiles([ev(self('dr.cheese', 'fake'), { from: 'fren1', to: 'bum.gpk', usedKey: pk(2) })], { [ID]: room }, 'bum.gpk')).toEqual({});
  });

  it('needs the sender\'s own room key and room membership', () => {
    expect(deriveRoomProfiles([ev(self('fren1', 'Fren'), { from: 'fren1', to: 'bum.gpk', usedKey: pk(9) })], { [ID]: room }, 'bum.gpk')).toEqual({});
    expect(deriveRoomProfiles([ev(self('outsider', 'X'), { from: 'outsider', to: 'bum.gpk', usedKey: pk(9) })], { [ID]: room }, 'bum.gpk')).toEqual({});
  });

  it('newest self update wins over an older one', () => {
    const p = deriveRoomProfiles([
      ev(self('fren1', 'Old'), { from: 'fren1', to: 'bum.gpk', usedKey: pk(2), time: 10 }),
      ev(self('fren1', 'New'), { from: 'fren1', to: 'bum.gpk', usedKey: pk(2), time: 20 }),
    ], { [ID]: room }, 'bum.gpk');
    expect(p.fren1.displayName).toBe('New');
  });

  it('nothing to send without a name or picture', () => {
    expect(encodeSelfRoomProfile(ID, { account: 'fren1' })).toBeNull();
  });
});
