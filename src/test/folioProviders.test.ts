import { describe, expect, it } from 'vitest';
import { hasCoverageGap, selectProviders } from '@/lib/folio/scanner';

describe('CHEESEFolio provider selection', () => {
  it('always includes the provider reaching furthest back, even if slowest', () => {
    const picked = selectProviders([
      { base: 'fast-partial', ms: 100, earliestTs: Date.parse('2026-02-19') },
      { base: 'faster-partial', ms: 50, earliestTs: Date.parse('2026-08-11') },
      { base: 'slow-full', ms: 2000, earliestTs: Date.parse('2024-12-28') },
      { base: 'fast-other', ms: 80, earliestTs: Date.parse('2026-03-01') },
    ], 3);
    expect(picked[0]).toBe('slow-full');
    expect(picked).toEqual(['slow-full', 'faster-partial', 'fast-other']);
  });
});

describe('CHEESEFolio coverage gap', () => {
  const created = Date.parse('2024-12-27T08:59:54Z');
  it('flags history that starts more than a day after creation', () => {
    expect(hasCoverageGap(Date.parse('2026-02-19'), created)).toBe(true);
  });
  it('does not flag history that starts within a day of creation', () => {
    expect(hasCoverageGap(Date.parse('2024-12-28T06:17:50Z'), created)).toBe(false);
  });
});
