import { describe, expect, it } from 'vitest';
import { generateKey } from '@/lib/cheeseCrypt';
import { encodeFounder, encodeModeration, encodeRoomPolicy, parseCg2, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';
import { canCollapseAuthor, deriveModeration, founderBadges } from '@/lib/cryptModeration';

const alice = generateKey('alice'), bob = generateKey('bob'), carol = generateKey('carol'), dave = generateKey('dave');
const id = '0123456789abcdef';
const g: InviteGroup = { id, name: 'room', created: 1, creator: 'alice', members: [alice, bob, carol, dave].map(k => ({ account: k.account, publicKey: k.publicKey })) };
const keys: Record<string, string> = { alice: alice.publicKey, carol: carol.publicKey, dave: dave.publicKey };
const event = (payload: string, time: number, from = 'alice'): Cg2Event => {
  const control = parseCg2(payload)!;
  return { key: `${time}`, txId: `${time}`, time, from, to: 'bob', usedKey: keys[from], control };
};
const policy = event(encodeRoomPolicy(id, true, ['alice', 'bob']), 1000);
const derive = (...e: Cg2Event[]) => deriveModeration([policy, ...e], { [id]: g }, 'bob')[id];

describe('owner-granted founders', () => {
  it('owner grant makes a member a founder who cannot be banned', () => {
    const s = derive(event(encodeFounder(id, 'carol'), 2000), event(encodeModeration(id, 'carol'), 3000));
    expect(s.protected).toContain('carol');
    expect(s.bans.carol).toBeUndefined();
    expect(founderBadges(s, g, true)).toContain('carol');
  });
  it('granted founders are immune to admin collapse', () => {
    const s = derive(event(encodeFounder(id, 'carol'), 2000));
    s.admins.push('dave');
    expect(canCollapseAuthor(s, g, 'dave', 'carol', 3000)).toBe(false);
  });
  it('ignores grants from non-owners', () => {
    expect(derive(event(encodeFounder(id, 'carol'), 2000, 'dave')).protected).not.toContain('carol');
  });
  it('a banned member cannot be made founder', () => {
    const s = derive(event(encodeModeration(id, 'carol'), 2000), event(encodeFounder(id, 'carol'), 3000));
    expect(s.protected).not.toContain('carol');
    expect(s.bans.carol).toBe(2000);
  });
  it('relisting keeps granted founders and cannot drop them', () => {
    const s = derive(event(encodeFounder(id, 'carol'), 2000), event(encodeRoomPolicy(id, false, ['alice', 'bob', 'carol']), 3000), event(encodeRoomPolicy(id, true, ['alice', 'bob']), 4000), event(encodeModeration(id, 'carol'), 5000));
    expect(s.protected).toEqual(['alice', 'bob', 'carol']);
    expect(s.bans.carol).toBeUndefined();
  });
});
