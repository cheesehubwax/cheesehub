import { describe, it, expect, beforeEach } from 'vitest';
import { loadHardening, saveHardening } from '@/lib/cryptPanicLock';

describe('lock hardening settings', () => {
  beforeEach(() => localStorage.clear());
  it('all three options default to off', () => {
    expect(loadHardening()).toEqual({ stealth: false, disconnect: false, cold: false });
  });
  it('saves and reloads each switch independently', () => {
    saveHardening({ stealth: true, disconnect: false, cold: true });
    expect(loadHardening()).toEqual({ stealth: true, disconnect: false, cold: true });
  });
  it('treats corrupted or non-boolean values as off', () => {
    localStorage.setItem('cheesecrypt-lock-hardening', '{"stealth":"yes","cold":1}');
    expect(loadHardening()).toEqual({ stealth: false, disconnect: false, cold: false });
  });
});
