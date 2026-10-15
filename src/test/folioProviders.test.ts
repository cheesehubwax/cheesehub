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

import { withoutRedispatches } from '@/lib/folio/classify';
import type { RawTransfer } from '@/lib/folio/types';

const tr = (gs: number, ord: number, parent: number, quantity = '100.0000 CHEESE'): RawTransfer => ({
  gs, trx: 'abc', ts: 0, contract: 'cheeseburger', from: 'liquidcheese', to: 'swap.alcor', quantity, memo: 'deposit', ord, parent,
});

describe('CHEESEFolio notification copies', () => {
  it('drops an inline copy created by an identical transfer, so the balance moves once', () => {
    const kept = withoutRedispatches([tr(1, 2, 0), tr(2, 4, 2)]);
    expect(kept.map((t) => t.gs)).toEqual([1]);
  });
  it('keeps two genuine identical transfers that are separate actions', () => {
    const kept = withoutRedispatches([tr(1, 2, 0), tr(2, 3, 0)]);
    expect(kept.map((t) => t.gs)).toEqual([1, 2]);
  });
});

import { isSyncComplete } from '@/lib/folio/scanner';

describe('CHEESEFolio sync completion', () => {
  it('is complete when the deepest provider finished, even if a shallow one dropped out', () => {
    expect(isSyncComplete(['deep', 'shallow'], new Set(['deep']))).toBe(true);
  });
  it('is not complete when the deepest provider failed', () => {
    expect(isSyncComplete(['deep', 'shallow'], new Set(['shallow']))).toBe(false);
  });
});
