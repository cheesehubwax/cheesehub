import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetInstantKey, generateInstantKey, instantIdleExpired, loadInstantKey, markInstantActive, saveInstantKey,
  INSTANT_IDLE_LIMIT_MS,
} from '@/lib/cryptInstant';

const HOUR = 60 * 60 * 1000;

describe('Instant Messaging key storage', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it('idle limit is 4 hours', () => {
    expect(INSTANT_IDLE_LIMIT_MS).toBe(4 * HOUR);
    expect(instantIdleExpired(0, 4 * HOUR - 1)).toBe(false);
    expect(instantIdleExpired(0, 4 * HOUR)).toBe(true);
    expect(instantIdleExpired(null, 0)).toBe(true);
  });

  it('keeps the key in this tab only, never localStorage', () => {
    const k = generateInstantKey('alice');
    saveInstantKey(k);
    expect(localStorage.getItem('cheesecrypt-instant:alice')).toBeNull();
    expect(loadInstantKey('alice')?.publicKey).toBe(k.publicKey);
  });

  it('drops the key after 4 hours idle, but keeps it after 3h59m', () => {
    const k = generateInstantKey('alice');
    saveInstantKey(k);
    markInstantActive('alice', 1_000);
    expect(loadInstantKey('alice', 1_000 + 4 * HOUR - 60_000)).not.toBeNull();
    expect(loadInstantKey('alice', 1_000 + 4 * HOUR)).toBeNull();
    expect(loadInstantKey('alice', 1_000)).toBeNull();
  });

  it('purges legacy localStorage keys', () => {
    const k = generateInstantKey('alice');
    localStorage.setItem('cheesecrypt-instant:alice', JSON.stringify(k));
    expect(loadInstantKey('alice')).toBeNull();
    expect(localStorage.getItem('cheesecrypt-instant:alice')).toBeNull();
  });

  it('forget removes the tab key', () => {
    saveInstantKey(generateInstantKey('alice'));
    forgetInstantKey('alice');
    expect(loadInstantKey('alice')).toBeNull();
  });
});
