import { beforeEach, describe, expect, it } from 'vitest';
import { filterVisibleListings, isSuppressed, loadLocalHides, saveLocalHides } from '@/lib/cryptRoomDenylist';

const a = { creator: 'dr.cheese', id: '8159da67cc9ab1fd' };
const b = { creator: 'bum.gpk', id: '0123456789abcdef' };
const c = { creator: 'bum.gpk', id: 'fedcba9876543210' };

describe('room directory suppression', () => {
  beforeEach(() => localStorage.clear());
  it('hides one exact room', () => {
    expect(filterVisibleListings([a, b, c], ['bum.gpk:0123456789abcdef'])).toEqual([a, c]);
  });
  it('a creator wildcard hides every room by that account', () => {
    expect(filterVisibleListings([a, b, c], ['bum.gpk:*'])).toEqual([a]);
  });
  it('nothing is hidden without entries', () => {
    expect(isSuppressed(a, [])).toBe(false);
  });
  it('local hides persist and drop malformed entries', () => {
    saveLocalHides(['dr.cheese:8159da67cc9ab1fd', 'junk', 'dr.cheese:8159da67cc9ab1fd']);
    expect(loadLocalHides()).toEqual(['dr.cheese:8159da67cc9ab1fd']);
  });
});
