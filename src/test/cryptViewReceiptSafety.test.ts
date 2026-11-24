import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveReadMarks } from '@/lib/cryptUnread';
import { saveSeenReports } from '@/lib/cryptModeration';

afterEach(() => vi.restoreAllMocks());
describe('chat view receipts when device storage fails', () => {
  it('does not interrupt opening or scrolling a room while saving unread timestamps', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    expect(() => saveReadMarks('alice', { 'group:0123456789abcdef': 123 })).not.toThrow();
  });
  it('does not interrupt report navigation while saving viewed report identities', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(() => saveSeenReports('alice', ['report:original'])).not.toThrow();
  });
});