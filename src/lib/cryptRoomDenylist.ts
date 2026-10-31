import type { RoomListing } from '@/lib/cryptRooms';
import { HISTORY_PAGE, hyperionTransfers, KEY_PUBLISH_TO, type ChainMemo } from '@/lib/cheeseCrypt';
import { fetchBannadAdmins } from '@/lib/adminData';

/**
 * Platform suppression of the public room directory, published on chain by CHEESEHub admins from /admin:
 * a 0.0001 CHEESE transfer to eosio.null with memo `CRYPTHIDE1:{"c":creator,"i":roomId|"*","h":1|0}`.
 * Only senders in the cheesebannad admins table (or cheesebannad itself) count; newest per target wins.
 * Display-only: the room listing and its chats stay on chain; hidden rooms just never render in CHEESEHub.
 */
export const HIDE_PREFIX = 'CRYPTHIDE1:';
export const HIDE_QUANTITY = '0.0001 CHEESE';
const PLATFORM_ACCOUNT = 'cheesebannad';
const ACCOUNT = /^[a-z1-5.]{1,12}$/;
const ROOM_ID = /^[a-f0-9]{16}$/;
const CACHE_KEY = 'cheesecrypt-room-hides-v1';
const ADMIN_PAGES = 10;

export interface HideTarget { creator: string; id: string } // id '*' = every room by creator
export interface HideRecord extends HideTarget { hidden: boolean; by: string; time: number; txId: string }

export const hideEntry = (t: HideTarget) => `${t.creator}:${t.id}`;

export function encodeHide(t: HideTarget, hidden: boolean): string {
  if (!ACCOUNT.test(t.creator) || (t.id !== '*' && !ROOM_ID.test(t.id))) throw new Error('Invalid room');
  return HIDE_PREFIX + JSON.stringify({ c: t.creator, i: t.id, h: hidden ? 1 : 0 });
}

export function parseHide(memo: string): (HideTarget & { hidden: boolean }) | null {
  if (!memo.startsWith(HIDE_PREFIX)) return null;
  try {
    const o = JSON.parse(memo.slice(HIDE_PREFIX.length));
    if (typeof o?.c !== 'string' || !ACCOUNT.test(o.c) || typeof o.i !== 'string' || (o.i !== '*' && !ROOM_ID.test(o.i)) || (o.h !== 0 && o.h !== 1)) return null;
    return { creator: o.c, id: o.i, hidden: o.h === 1 };
  } catch { return null; }
}

/** Newest admin decision per target, from paid eosio.null legs sent by an authorised admin only. */
export function collectHides(rows: ChainMemo[], admins: readonly string[]): HideRecord[] {
  const allowed = new Set([...admins, PLATFORM_ACCOUNT]);
  const latest = new Map<string, HideRecord>();
  for (const r of [...rows].sort((a, b) => a.time - b.time)) {
    if (r.to !== KEY_PUBLISH_TO || !allowed.has(r.from) || !/^\d+\.\d{4} CHEESE$/.test(r.quantity.trim())) continue;
    const h = parseHide(r.memo);
    if (!h) continue;
    latest.set(hideEntry(h), { ...h, by: r.from, time: r.time, txId: r.txId });
  }
  return [...latest.values()].sort((a, b) => b.time - a.time);
}

export const activeHides = (records: readonly HideRecord[]) => records.filter(r => r.hidden).map(hideEntry);

export function isSuppressed(l: Pick<RoomListing, 'creator' | 'id'>, hides: readonly string[]): boolean {
  return hides.includes(`${l.creator}:${l.id}`) || hides.includes(`${l.creator}:*`);
}

export function filterVisibleListings<T extends Pick<RoomListing, 'creator' | 'id'>>(listings: T[], hides: readonly string[]): T[] {
  return hides.length ? listings.filter(l => !isSuppressed(l, hides)) : listings;
}

/** Full read of every admin's eosio.null CHEESE history (admin accounts are small, so hides never age out). */
export async function fetchRoomHides(): Promise<HideRecord[]> {
  const admins = (await fetchBannadAdmins()).map(a => a.account).filter(a => ACCOUNT.test(a));
  const senders = [...new Set([...admins, PLATFORM_ACCOUNT])];
  const per = await Promise.all(senders.map(async account => {
    let rows: ChainMemo[] = [];
    let before: string | null = null;
    for (let p = 0; p < ADMIN_PAGES; p++) {
      const page = await hyperionTransfers(`account=${account}&filter=cheeseburger:transfer&transfer.from=${account}&transfer.to=${KEY_PUBLISH_TO}&sort=desc&limit=${HISTORY_PAGE}${before ? `&before=${encodeURIComponent(before)}` : ''}`);
      rows = rows.concat(page);
      if (page.length < HISTORY_PAGE) break;
      const oldest = Math.min(...page.map(r => r.time).filter(Number.isFinite));
      if (!Number.isFinite(oldest)) break;
      before = new Date(oldest).toISOString();
    }
    return rows;
  }));
  const records = collectHides(per.flat(), admins);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(activeHides(records))); } catch { /* storage full or blocked */ }
  return records;
}

/** Last successfully read hide list, so hidden rooms stay hidden while history nodes are down. */
export function cachedHides(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[a-z1-5.]{1,12}:(\*|[a-f0-9]{16})$/.test(x)) : [];
  } catch { return []; }
}

export function buildHideAction(admin: string, auth: unknown[], target: HideTarget, hidden: boolean) {
  return { account: 'cheeseburger', name: 'transfer', authorization: auth, data: { from: admin, to: KEY_PUBLISH_TO, quantity: HIDE_QUANTITY, memo: encodeHide(target, hidden) } };
}

/**
 * Curated directory: only rooms listed by CHEESEHub admins (cheesebannad admins table, or cheesebannad itself)
 * appear in Discover. Display-only; anyone can still write a listing memo on chain, CHEESEHub just never shows it.
 * Fails closed: with no admin list known, nothing is shown.
 */
const CURATORS_CACHE_KEY = 'cheesecrypt-room-curators-v1';
export const curatorSet = (admins: readonly string[]) => new Set([...admins.filter(a => ACCOUNT.test(a)), PLATFORM_ACCOUNT]);
export function filterCuratedListings<T extends Pick<RoomListing, 'creator'>>(listings: T[], curators: ReadonlySet<string>): T[] {
  return listings.filter(l => curators.has(l.creator));
}
export async function fetchRoomCurators(): Promise<string[]> {
  const admins = (await fetchBannadAdmins()).map(a => a.account).filter(a => ACCOUNT.test(a));
  try { localStorage.setItem(CURATORS_CACHE_KEY, JSON.stringify(admins)); } catch { /* storage blocked */ }
  return admins;
}
export function cachedCurators(): string[] {
  try { const v = JSON.parse(localStorage.getItem(CURATORS_CACHE_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((a: unknown) => typeof a === 'string' && ACCOUNT.test(a)) : []; } catch { return []; }
}
