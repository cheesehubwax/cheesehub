import type { InviteGroupView } from '@/lib/cryptInviteGroups';
import { restrictedAt, type RoomModeration } from '@/lib/cryptModeration';

/** Retained keys permit requesting owner approval, never direct self-rejoin. */
export function canRequestRejoin(view: InviteGroupView | undefined, account: string, state: RoomModeration | undefined, now: number) {
  return !!view && view.status === 'left' && view.invite.members.some(m => m.account === account)
    && !restrictedAt(state, account, now);
}