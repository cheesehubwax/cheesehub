import { describe, it, expect } from 'vitest';
import { normaliseSuffix, suffixAccountsFromActions } from '@/lib/airdropSuffix';

const na = (creator: string, newact: string) => ({
  act: { account: 'eosio', name: 'newaccount', data: { creator, newact } },
});

describe('suffix snapshot', () => {
  it('normalises input', () => {
    expect(normaliseSuffix(' .GM ')).toBe('gm');
    expect(normaliseSuffix('c.wam')).toBe('c.wam');
    expect(normaliseSuffix('bad!')).toBeNull();
    expect(normaliseSuffix('')).toBeNull();
  });

  it('keeps only names ending in .suffix created by the suffix owner', () => {
    const accounts = suffixAccountsFromActions(
      [na('gm', 'loop.gm'), na('gm', 'loop.gm'), na('gm', 'other'), na('x', 'fake.gm'), na('gm', 'a.gm')],
      'gm',
    );
    expect(accounts).toEqual(['a.gm', 'loop.gm']);
  });
});
