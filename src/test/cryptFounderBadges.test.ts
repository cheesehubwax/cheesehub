import { describe, expect, it } from 'vitest';
import { founderBadges } from '@/lib/cryptModeration';
import type { InviteGroup } from '@/lib/cryptInviteGroups';

const g = { id: 'r', creator: 'owner', members: [{ account: 'owner' }, { account: 'fren1' }, { account: 'bum.gpk' }, { account: 'late' }] } as unknown as InviteGroup;
const state = { listed: true, protected: ['owner', 'fren1', 'bum.gpk'], bans: {}, mutes: {}, admins: [], collapses: {} };

describe('founder badges', () => {
  it('uses the frozen roster including the owner', () => {
    expect(founderBadges(state, g, true)).toEqual(['owner', 'fren1', 'bum.gpk']);
  });
  it('treats all current members as founders when a listed room has no roster policy', () => {
    expect(founderBadges(undefined, g, true)).toEqual(['owner', 'fren1', 'bum.gpk', 'late']);
  });
  it('shows no founders for a room that was never public', () => {
    expect(founderBadges(undefined, g, false)).toEqual([]);
  });
});
