import { describe, expect, it, beforeEach } from 'vitest';
import { createDoubleEscDetector, DEFAULT_IDLE_MINUTES, idleExpired, loadIdleMinutes, saveIdleMinutes } from '@/lib/cryptPanicLock';
import { forgetSessionKey, generateKey, loadKey, saveKey } from '@/lib/cheeseCrypt';

describe('panic lock', () => {
  beforeEach(() => localStorage.clear());
  it('defaults to 4 hours (matching the instant session key) and expires exactly then', () => {
    expect(DEFAULT_IDLE_MINUTES).toBe(240);
    expect(loadIdleMinutes()).toBe(240);
    expect(idleExpired(0, 240, 240 * 60_000 - 1)).toBe(false);
    expect(idleExpired(0, 240, 240 * 60_000)).toBe(true);
  });
  it('Off never expires and invalid stored values fall back', () => {
    expect(idleExpired(0, 0, 10 ** 12)).toBe(false);
    saveIdleMinutes(0); expect(loadIdleMinutes()).toBe(0);
    localStorage.setItem('cheesecrypt-autolock-minutes', '7'); expect(loadIdleMinutes()).toBe(240);
  });
  it('double Esc within 600ms locks, slower does not', () => {
    const d = createDoubleEscDetector();
    expect(d(1000)).toBe(false); expect(d(1600)).toBe(true);
    const s = createDoubleEscDetector();
    expect(s(1000)).toBe(false); expect(s(1601)).toBe(false);
  });
  it('forgetSessionKey drops the unlocked key from memory', () => {
    const k = generateKey('alice');
    saveKey(k); expect(loadKey('alice')?.publicKey).toBe(k.publicKey);
    forgetSessionKey('alice'); expect(loadKey('alice')).toBeNull();
  });
});
