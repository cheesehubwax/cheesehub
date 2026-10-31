import { describe, expect, it } from 'vitest';
import { activeHides, collectHides, encodeHide, filterVisibleListings, parseHide } from '@/lib/cryptRoomDenylist';
import type { ChainMemo } from '@/lib/cheeseCrypt';

const room = { creator: 'dr.cheese', id: '8159da67cc9ab1fd' };
const other = { creator: 'bum.gpk', id: '0123456789abcdef' };
const leg = (from: string, memo: string, time: number, to = 'eosio.null'): ChainMemo => ({ from, to, memo, time, txId: `t${time}`, quantity: '0.0001 CHEESE' });

describe('admin room hides', () => {
  it('an admin hide removes the room for everyone', () => {
    const hides = activeHides(collectHides([leg('fragglerockk', encodeHide(room, true), 1)], ['fragglerockk']));
    expect(filterVisibleListings([room, other], hides)).toEqual([other]);
  });
  it('a non-admin hide memo is ignored', () => {
    expect(activeHides(collectHides([leg('mallory', encodeHide(room, true), 1)], ['fragglerockk']))).toEqual([]);
  });
  it('a hide not sent to eosio.null is ignored', () => {
    expect(activeHides(collectHides([leg('fragglerockk', encodeHide(room, true), 1, 'someone')], ['fragglerockk']))).toEqual([]);
  });
  it('a later restore wins over an earlier hide, from any admin', () => {
    const rows = [leg('fragglerockk', encodeHide(room, true), 1), leg('qu.ug.wam', encodeHide(room, false), 2)];
    expect(activeHides(collectHides(rows, ['fragglerockk', 'qu.ug.wam']))).toEqual([]);
  });
  it('a whole-account hide removes every room by that creator', () => {
    const hides = activeHides(collectHides([leg('cheesebannad', encodeHide({ creator: 'bum.gpk', id: '*' }, true), 1)], []));
    expect(filterVisibleListings([room, other, { creator: 'bum.gpk', id: 'fedcba9876543210' }], hides)).toEqual([room]);
  });
  it('malformed hide memos are rejected', () => {
    expect(parseHide('CRYPTHIDE1:{"c":"BAD","i":"*","h":1}')).toBeNull();
    expect(parseHide('CRYPTHIDE1:{"c":"bum.gpk","i":"xyz","h":1}')).toBeNull();
  });
});

import { curatorSet, filterCuratedListings } from '@/lib/cryptRoomDenylist';
describe('curated public room directory', () => {
  const ls = [{ creator: 'dr.cheese', id: 'a' }, { creator: 'randomuser11', id: 'b' }, { creator: 'cheesebannad', id: 'c' }];
  it('shows only rooms listed by admins or cheesebannad', () => {
    expect(filterCuratedListings(ls, curatorSet(['dr.cheese'])).map(l => l.id)).toEqual(['a', 'c']);
  });
  it('hides every non-platform listing when no admin list is known', () => {
    expect(filterCuratedListings(ls, curatorSet([])).map(l => l.id)).toEqual(['c']);
  });
});
