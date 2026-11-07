import { describe, it, expect, beforeEach } from 'vitest';
import { loadHardening, saveHardening } from '@/lib/cryptPanicLock';

describe('lock hardening settings', () => {
  beforeEach(() => localStorage.clear());
  it('cold lock defaults to off (stealth redirect and wallet disconnect are always on, not stored)', () => {
    expect(loadHardening()).toEqual({ cold: false });
  });
  it('saves and reloads the cold lock switch', () => {
    saveHardening({ cold: true });
    expect(loadHardening()).toEqual({ cold: true });
  });
  it('treats corrupted or legacy values as off', () => {
    localStorage.setItem('cheesecrypt-lock-hardening', '{"stealth":true,"cold":1}');
    expect(loadHardening()).toEqual({ cold: false });
  });
});
