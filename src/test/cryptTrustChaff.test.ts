import { describe, expect, it } from 'vitest';
import { DECOY_POOL, JITTER_MAX_MS, JITTER_MIN_MS, jitterMs, pickDecoy } from '@/lib/cryptTrustChaff';

describe('Respect decoys', () => {
  it('never picks the real account', () => {
    for (let i = 0; i < 50; i++) expect(pickDecoy('cheeseburger', ['cheeseburger'], () => i / 50)).not.toBe('cheeseburger');
  });
  it('can pick previously seen accounts as well as the fixed pool', () => {
    expect(pickDecoy('alice', ['bob'], () => 0.9999)).toBe('bob');
    expect(DECOY_POOL).toContain(pickDecoy('alice', [], () => 0) as never);
  });
  it('keeps the gap between 150 and 400 ms', () => {
    expect(jitterMs(() => 0)).toBe(JITTER_MIN_MS);
    expect(jitterMs(() => 0.9999)).toBeLessThanOrEqual(JITTER_MAX_MS);
  });
});
