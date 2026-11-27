import { beforeEach, describe, expect, it } from 'vitest';
import { getPermanent, setPermanent } from '@/lib/cryptTrustPermanent';

describe('permanent Respect signals', () => {
  beforeEach(() => localStorage.clear());
  it('remembers a confirmed creation time', () => {
    setPermanent('created', 'alice', 1_600_000_000_000);
    expect(getPermanent('created', 'alice')).toBe(1_600_000_000_000);
    expect(getPermanent('created', 'bob')).toBeNull();
  });
  it('never stores unknown values', () => {
    setPermanent('created', 'alice', null);
    setPermanent('firstKey', 'alice', NaN);
    expect(getPermanent('created', 'alice')).toBeNull();
    expect(getPermanent('firstKey', 'alice')).toBeNull();
  });
  it('earliest key time only moves earlier', () => {
    setPermanent('firstKey', 'alice', 2000);
    setPermanent('firstKey', 'alice', 3000);
    expect(getPermanent('firstKey', 'alice')).toBe(2000);
    setPermanent('firstKey', 'alice', 1000);
    expect(getPermanent('firstKey', 'alice')).toBe(1000);
  });
});
