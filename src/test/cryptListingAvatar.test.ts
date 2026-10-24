import { describe, expect, it } from 'vitest';
import { encodeListing, parseRoomMemo } from '@/lib/cryptRooms';

const key = 'A'.repeat(43) + '=';
const pic = '1'.repeat(64);
describe('room listing picture', () => {
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
