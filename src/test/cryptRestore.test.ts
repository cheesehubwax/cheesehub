import { describe, expect, it } from 'vitest';
import { encryptMemo, generateKey, splitMessage, type ChainMemo } from '@/lib/cheeseCrypt';
import { encodeGroupText, encodeNotice } from '@/lib/cryptInviteGroups';
import { encodeJoinMemo, type RoomListing } from '@/lib/cryptRooms';
import { isAccountStorageKey, recoveryCandidates, recoverFriends, recoverRoomRequests } from '@/lib/cryptRestore';

const me = generateKey('bob'), owner = generateKey('alice');
const id = '00112233445566ff';
const listing: RoomListing = { id, creator: owner.account, publicKey: owner.publicKey, name: 'Club', topic: '', tags: [], members: 2, time: 1, txId: 'listing' };
const sent = (text: string, time = 10): ChainMemo => ({ from: me.account, to: owner.account, time, txId: `tx${time}`, quantity: '0.0001 CHEESE', memo: encryptMemo(text, owner.publicKey, me.secretKey) });

describe('authenticated recovery', () => {
  it('restores a prior outgoing direct chat with a verified published key', () => {
    expect(recoverFriends([sent('Hello')], me, { alice: owner.publicKey })).toEqual({ alice: owner.publicKey });
  });
  it('never turns incoming strangers or group traffic into friends', () => {
    const incoming = { ...sent('Hello'), from: 'alice', to: 'bob', memo: encryptMemo('Hello', me.publicKey, owner.secretKey) };
    expect(recoverFriends([incoming, sent(encodeGroupText(id, 'Group hello')), sent(encodeNotice('join', id))], me, { alice: owner.publicKey })).toEqual({});
  });
  it('rejects wrong keys and incomplete direct messages', () => {
    const part = splitMessage('x'.repeat(400))[0];
    expect(recoverFriends([sent(part)], me, { alice: owner.publicKey })).toEqual({});
    expect(recoverFriends([sent('Hello')], me, { alice: generateKey('eve').publicKey })).toEqual({});
  });
  it('restores only the room named by an authenticated outgoing request', () => {
    const request = { ...sent('unused'), memo: encodeJoinMemo(me, id, owner.publicKey) };
    expect(recoverRoomRequests([request], me, [listing, { ...listing, id: 'ffeeddccbbaa0099' }], {})).toEqual({ [id]: { id, creator: 'alice', publicKey: owner.publicKey, name: 'Club', time: 10 } });
  });
  it('uses an own joined notice when the original request is outside history', () => {
    expect(recoverRoomRequests([sent(encodeNotice('joined', id))], me, [listing], {})[id]?.publicKey).toBe(owner.publicKey);
  });
  it('does not trust a listing without outgoing consent or a wrong creator key', () => {
    expect(recoverRoomRequests([], me, [listing], {})).toEqual({});
    expect(recoverRoomRequests([sent(encodeNotice('joined', id))], me, [{ ...listing, publicKey: generateKey('eve').publicKey }], {})).toEqual({});
  });
  it('bounds discovery to ten own recipients and honors exclusions', () => {
    const memos = Array.from({ length: 15 }, (_, n) => ({ ...sent('hi'), to: `peer${String.fromCharCode(97 + n)}`, time: n }));
    expect(recoveryCandidates(memos, 'bob', new Set(['peero']))).toHaveLength(10);
    expect(recoveryCandidates(memos, 'bob', new Set(['peero']))).not.toContain('peero');
  });
  it('syncs only current-account CHEESECrypt storage or storage clear', () => {
    expect(isAccountStorageKey('cheesecrypt-contacts-bob', 'bob')).toBe(true);
    expect(isAccountStorageKey('cheesecrypt-contacts-alice', 'bob')).toBe(false);
    expect(isAccountStorageKey('wallet-bob', 'bob')).toBe(false);
    expect(isAccountStorageKey(null, 'bob')).toBe(true);
  });
});