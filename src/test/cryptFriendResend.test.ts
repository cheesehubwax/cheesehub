import { describe, it, expect } from 'vitest';
import { friendRequestResendable, FRIEND_REQUEST_RESEND_MS } from '@/lib/cryptInviteGroups';

const DAY = 24 * 60 * 60 * 1000;
describe('friend request resend window', () => {
  it('is 30 days', () => expect(FRIEND_REQUEST_RESEND_MS).toBe(30 * DAY));
  it('blocks resending within 30 days', () => expect(friendRequestResendable(0, 30 * DAY - 1)).toBe(false));
  it('allows resending after 30 days', () => expect(friendRequestResendable(0, 30 * DAY)).toBe(true));
  it('allows sending when never requested', () => expect(friendRequestResendable(undefined, 0)).toBe(true));
});
