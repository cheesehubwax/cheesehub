import { describe, expect, it } from 'vitest';
import { canRequestRejoin } from '@/lib/cryptRejoin';
import { deriveInviteGroups, type InviteGroup } from '@/lib/cryptInviteGroups';
import type { RoomModeration } from '@/lib/cryptModeration';

const invite: InviteGroup = { id: '00112233445566ff', creator: 'alice', created: 1, name: 'Room', members: [{ account: 'alice', publicKey: 'owner' }, { account: 'bob', publicKey: 'member' }] };
const view = deriveInviteGroups([], { [invite.id]: invite }, 'bob', { [invite.id]: { status: 'left', at: 2 } })[0];
const state: RoomModeration = { listed: true, protected: ['alice'], bans: {}, mutes: {}, admins: [], collapses: {} };

describe('owner readmission request eligibility', () => {
  it('permits former members to request owner approval', () => expect(canRequestRejoin(view, 'bob', state, 1000)).toBe(true));
  it('never admits a newcomer using someone else’s retained invite', () => expect(canRequestRejoin(view, 'carol', state, 1000)).toBe(false));
  it('does not bypass a ban', () => expect(canRequestRejoin(view, 'bob', { ...state, bans: { bob: 500 } }, 1000)).toBe(false));
  it('does not bypass an active mute and permits a request after expiry', () => {
    const muted = { ...state, mutes: { bob: [{ from: 500, until: 1500 }] } };
    expect(canRequestRejoin(view, 'bob', muted, 1000)).toBe(false);
    expect(canRequestRejoin(view, 'bob', muted, 1500)).toBe(true);
  });
  it('does not rejoin already joined or merely invited members', () => {
    expect(canRequestRejoin({ ...view, status: 'joined' }, 'bob', state, 1000)).toBe(false);
    expect(canRequestRejoin({ ...view, status: 'invited' }, 'bob', state, 1000)).toBe(false);
  });
});