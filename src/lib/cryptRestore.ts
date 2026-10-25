import { type ChainMemo, type MessagingKey } from '@/lib/cheeseCrypt';
import { decodeConversations, isDirectMessage } from '@/lib/cryptGroups';
import { decodeRoomEvents, joinMemoKey, type RoomListing, type RoomRequest } from '@/lib/cryptRooms';

/** Discovery is bounded and only our own sent history can establish prior consent. */
export function recoveryCandidates(memos: ChainMemo[], account: string, excluded: Set<string>): string[] {
  return [...new Set([...memos].sort((a, b) => b.time - a.time)
    .filter(m => m.from === account && m.to !== account && /^[a-z1-5.]{1,12}$/.test(m.to) && !excluded.has(m.to))
    .map(m => m.to))].slice(0, 10);
}

/** A published key alone is not friendship: require a complete, readable, outgoing DM. */
export function recoverFriends(memos: ChainMemo[], key: MessagingKey, published: Record<string, string>): Record<string, string> {
  const recovered: Record<string, string> = {};
  for (const [account, publicKey] of Object.entries(published)) {
    const messages = decodeConversations(memos.filter(m => m.from === key.account && m.to === account), key, { [account]: publicKey });
    if (messages.some(m => isDirectMessage(m, key.account, account) && !m.missing &&
      ((m.text?.trim() && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(m.text)) || (m.voice && !m.voice.isGroup && !m.voice.missing))))
      recovered[account] = publicKey;
  }
  return recovered;
}

/** Listing keys open only matching room controls. Own authenticated requests/joins prove consent. */
export function recoverRoomRequests(memos: ChainMemo[], key: MessagingKey, listings: RoomListing[], stored: Record<string, RoomRequest>): Record<string, RoomRequest> {
  const recovered = { ...stored };
  for (const listing of listings) {
    if (listing.creator === key.account || stored[listing.id]) continue;
    const sent = memos.filter(m => m.from === key.account && m.to === listing.creator);
    const evidence = decodeRoomEvents(sent, key, { [listing.creator]: listing.publicKey })
      .filter(e => (e.control.kind === 'join' || e.control.kind === 'joined') && e.control.id === listing.id)
      .sort((a, b) => a.time - b.time);
    const first = evidence.find(e => e.control.kind === 'joined' || sent.some(m => m.txId === e.txId &&
      (!joinMemoKey(m.memo) || joinMemoKey(m.memo) === key.publicKey)));
    if (first) recovered[listing.id] = { id: listing.id, creator: listing.creator, publicKey: listing.publicKey, name: listing.name, time: first.time };
  }
  return recovered;
}

/** Storage events are origin-scoped; never read another wallet's state. */
export function isAccountStorageKey(storageKey: string | null, account: string): boolean {
  return storageKey === null || (storageKey.startsWith('cheesecrypt-') && storageKey.endsWith(`-${account}`));
}