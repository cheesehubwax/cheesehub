import { describe, it, expect, beforeEach } from 'vitest';
import { baselineMarks, firstUnreadIndex, loadReadMarks, saveReadMarks, unreadCounts } from '@/lib/cryptUnread';
const me = 'alice';
const m = (from: string, to: string, time: number, group: string | null = null) => ({ from, to, time, group: group ? { id: group } : null });
describe('CHEESECrypt unread badges', () => {
  beforeEach(() => localStorage.clear());
  const history = [m('bob', me, 1), m(me, 'bob', 2), m('carol', me, 3), m('bob', me, 4, 'g1')];
  it('existing history starts with no badges', () => {
    expect(unreadCounts(history, me, baselineMarks(history, me))).toEqual({});
  });
  it('counts new incoming messages per friend and group, never own messages', () => {
    const marks = baselineMarks(history, me);
    const next = [...history, m('bob', me, 5), m('bob', me, 6), m(me, 'carol', 7), m('carol', me, 8, 'g1')];
    expect(unreadCounts(next, me, marks)).toEqual({ bob: 2, 'group:g1': 1 });
  });
  it('resume point finds the first message newer than the read marker', () => {
    expect(firstUnreadIndex(history, 2)).toBe(2); // carol's message at t=3
    expect(firstUnreadIndex(history, 4)).toBe(-1); // everything read
    expect(firstUnreadIndex(history, null)).toBe(-1); // no resume point
    expect(firstUnreadIndex(history, 0)).toBe(0); // nothing read yet
  });
  it('reading a conversation clears only its badge and persists per account', () => {
    const marks = { ...baselineMarks(history, me), bob: 6 };
    saveReadMarks(me, marks);
    expect(loadReadMarks('bob')).toBeNull();
    const next = [...history, m('bob', me, 5), m('bob', me, 6), m('carol', me, 9)];
    expect(unreadCounts(next, me, loadReadMarks(me)!)).toEqual({ carol: 1 });
  });
});
