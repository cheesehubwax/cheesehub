import { describe, it, expect } from 'vitest';
import { nextLocalTime, secondsLeft, formatLeft, SCHEDULE_MAX_MS } from '../cryptSchedule';

describe('cryptSchedule', () => {
  const now = new Date(2026, 10, 26, 22, 30, 0).getTime();
  it('picks later today when the time is still ahead', () => {
    expect(nextLocalTime('23:15', now)).toBe(new Date(2026, 10, 26, 23, 15).getTime());
  });
  it('rolls to tomorrow when the time has passed, staying within 24h', () => {
    const t = nextLocalTime('03:00', now)!;
    expect(t).toBe(new Date(2026, 10, 27, 3, 0).getTime());
    expect(t - now).toBeLessThanOrEqual(SCHEDULE_MAX_MS);
  });
  it('treats the exact current minute as tomorrow', () => {
    expect(nextLocalTime('22:30', now)).toBe(new Date(2026, 10, 27, 22, 30).getTime());
  });
  it('rejects malformed times', () => {
    expect(nextLocalTime('24:00', now)).toBeNull();
    expect(nextLocalTime('7pm', now)).toBeNull();
  });
  it('counts remaining seconds from the wall clock', () => {
    expect(secondsLeft(now + 1500, now)).toBe(2);
    expect(secondsLeft(now - 5000, now)).toBe(0);
  });
  it('formats remaining time', () => {
    expect(formatLeft(45)).toBe('45s');
    expect(formatLeft(725)).toBe('12m 05s');
    expect(formatLeft(7380)).toBe('2h 03m');
  });
});
