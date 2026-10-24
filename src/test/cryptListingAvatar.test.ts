import { describe, expect, it } from 'vitest';
import { collectListings, encodeListing, parseRoomMemo, searchListings } from '@/lib/cryptRooms';

const key = 'A'.repeat(43) + '=';
const pic = '1'.repeat(64);
describe('room listing picture', () => {
  it('preserves cheeseplum as the public username while dr.cheese remains the creator identity', () => {
    const memo = encodeListing({ id: 'a'.repeat(16), name: 'CHEESE', topic: '', tags: [], publicKey: key, members: 3, creatorName: 'cheeseplum' });
    const listings = collectListings([{ from: 'dr.cheese', to: 'eosio.null', quantity: '8.0000 CHEESE', memo, time: 1, txId: 'listing' }]);
    expect(listings[0]?.creatorName).toBe('cheeseplum');
    expect(listings[0]?.creator).toBe('dr.cheese');
    expect(searchListings(listings, 'cheeseplum')).toHaveLength(1);
  });
  it('rejects an invalid username rather than trusting it as listing metadata', () => {
    expect(() => encodeListing({ id: 'a'.repeat(16), name: 'CHEESE', topic: '', tags: [], publicKey: key, members: 3, creatorName: 'bad\u202ename' })).toThrow('Invalid room listing');
  });
  it('carries the room picture when it fits', () => {
    const r = parseRoomMemo(encodeListing({ id: 'a'.repeat(16), name: 'CHEESE', topic: 'Cheese chat', tags: ['wax'], publicKey: key, members: 3, avatar: pic }));
    expect(r?.kind === 'list' && r.listing.avatar).toBe(pic);
  });
  it('drops the picture instead of failing when text fills the memo', () => {
    const memo = encodeListing({ id: 'a'.repeat(16), name: 'n'.repeat(32), topic: 't'.repeat(56), tags: ['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc'], publicKey: key, members: 50, avatar: pic });
    const r = parseRoomMemo(memo);
    expect(r?.kind).toBe('list');
    expect(r?.kind === 'list' ? r.listing.avatar : 'x').toBeUndefined();
  });
});
