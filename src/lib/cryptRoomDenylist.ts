import type { RoomListing } from '@/lib/cryptRooms';

/**
 * Operator suppression for the public room directory. Display-only: the chain listing is untouched and
 * cannot be erased; suppressed rooms simply never render in CHEESEHub's directory. Entries are
 * `creator:roomId` (one room) or `creator:*` (every room from that account).
 * To hide a room for every visitor, add its entry here (Export in the directory copies the current hides).
 */
export const GLOBAL_ROOM_DENYLIST: readonly string[] = [];

const STORAGE_KEY = 'cheesecrypt-room-hides';
export const roomEntry = (l: Pick<RoomListing, 'creator' | 'id'>) => `${l.creator}:${l.id}`;
const VALID = /^[a-z1-5.]{1,12}:(\*|[a-f0-9]{16})$/;

export function loadLocalHides(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && VALID.test(x)) : [];
  } catch { return []; }
}

export function saveLocalHides(hides: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(hides.filter(x => VALID.test(x)))]));
}

export function isSuppressed(l: Pick<RoomListing, 'creator' | 'id'>, hides: readonly string[]): boolean {
  const all = [...GLOBAL_ROOM_DENYLIST, ...hides];
  return all.includes(roomEntry(l)) || all.includes(`${l.creator}:*`);
}

export const isGloballySuppressed = (l: Pick<RoomListing, 'creator' | 'id'>) => isSuppressed(l, []);

export function filterVisibleListings<T extends Pick<RoomListing, 'creator' | 'id'>>(listings: T[], hides: readonly string[]): T[] {
  return listings.filter(l => !isSuppressed(l, hides));
}
