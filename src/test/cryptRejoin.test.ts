import { describe, expect, it } from 'vitest';
import { canRejoin } from '@/lib/cryptRejoin';
import { deriveInviteGroups, type InviteGroup } from '@/lib/cryptInviteGroups';
import type { RoomModeration } from '@/lib/cryptModeration';

const invite: InviteGroup = { id: '00112233445566ff', creator: 'alice', created: 1, name: 'Room', members: [{ account: 'alice', publicKey: 'owner' }, { account: 'bob', publicKey: 'member' }] };
const view = deriveInviteGroups([], { [invite.id]: invite }, 'bob', { [invite.id]: { status: 'left', at: 2 } })[0];
const state: RoomModeration = { listed: true, protected: ['alice'], bans: {}, mutes: {}, admins: [], collapses: {} };

describe('retained room rejoin eligibility', () => {
  it('permits former members with their retained invite', () => expect(canRejoin(view, 'bob', state, 1000)).toBe(true));
  it('never admits a newcomer using someone else’s retained invite', () => expect(canRejoin(view, 'carol', state, 1000)).toBe(false));
  it('does not bypass a ban', () => expect(canRejoin(view, 'bob', { ...state, bans: { bob: 500 } }, 1000)).toBe(false));
  it('does not bypass an active mute and permits rejoin after expiry', () => {
    const muted = { ...state, mutes: { bob: [{ from: 500, until: 1500 }] } };
    expect(canRejoin(view, 'bob', muted, 1000)).toBe(false);
    expect(canRejoin(view, 'bob', muted, 1500)).toBe(true);
  });
  it('does not rejoin already joined or merely invited members', () => {
    expect(canRejoin({ ...view, status: 'joined' }, 'bob', state, 1000)).toBe(false);
    expect(canRejoin({ ...view, status: 'invited' }, 'bob', state, 1000)).toBe(false);
  });
});