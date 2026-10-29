import type { InviteGroupView } from '@/lib/cryptInviteGroups';
import { restrictedAt, type RoomModeration } from '@/lib/cryptModeration';

/** Retained membership keys permit rejoining, not new admission or escaping moderation. */
export function canRejoin(view: InviteGroupView | undefined, account: string, state: RoomModeration | undefined, now: number) {
  return !!view && view.status === 'left' && view.invite.members.some(m => m.account === account)
    && !restrictedAt(state, account, now);
}