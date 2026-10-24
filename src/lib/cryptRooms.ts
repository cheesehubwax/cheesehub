// CHEESECrypt public rooms. A creator may publish a plaintext listing for one of their invite (CG2) groups so
// others can find it and ask to join in an encrypted message. Only the room's name, topic, tags, member count,
// creator account and the creator's public key are public — never the member list or any message.
// Listing and unlisting pay the normal platform fee (80% eosio.null / 20% xcheeseliqst); both fee legs carry the memo.
import { decodeBase64 } from 'tweetnacl-util';
import {
  assembleMessages, bytesToText, buildCryptFeeActions, decryptMemoBytes, KEY_PUBLISH_TO, MEMO_MAX_BYTES, MESSAGE_FEE_QUANTITY,
  type ChainMemo, type MessagingKey,
} from '@/lib/cheeseCrypt';
import { isCg2, MAX_PUBLIC_ROOM_MEMBERS, parseCg2, type Cg2Event, type RoomInviter } from '@/lib/cryptInviteGroups';

export const ROOM_PREFIX = 'CRYPTROOM1:';
export const UNLIST_PREFIX = `${ROOM_PREFIX}unlist:`;
export const ROOM_FEE_QUANTITY = MESSAGE_FEE_QUANTITY;
/** The eosio.null leg of a listing fee (80% of the room fee, in 0.0001 CHEESE units). */
export const ROOM_NULL_UNITS = Math.round(parseFloat(ROOM_FEE_QUANTITY) * 10000) * 4 / 5;
export const MAX_ROOM_NAME = 32;
export const MAX_ROOM_TOPIC = 56;
export const MAX_ROOM_TAGS = 3;
export const ROOM_TAG_RE = /^[a-z0-9-]{1,10}$/;
const ID = /^[a-f0-9]{16}$/;
const ACCOUNT = /^[a-z1-5.]{1,12}$/;
const utf8Len = (s: string) => new TextEncoder().encode(s).length;

export interface RoomListingInput { id: string; name: string; topic: string; tags: string[]; publicKey: string; members: number }
export interface RoomListing extends RoomListingInput { creator: string; time: number; txId: string }

// eslint-disable-next-line no-control-regex
const clean = (s: string, max: number) => [...s.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();
export const cleanRoomName = (s: string) => clean(s, MAX_ROOM_NAME);
export const cleanRoomTopic = (s: string) => clean(s, MAX_ROOM_TOPIC);
export function cleanTags(raw: string): string[] {
  const out: string[] = [];
  for (const t of raw.toLowerCase().split(/[\s,#]+/)) {
    const tag = t.replace(/[^a-z0-9-]/g, '').slice(0, 10);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, MAX_ROOM_TAGS);
}

const validKey = (k: unknown): k is string => {
  if (typeof k !== 'string') return false;
  try { return decodeBase64(k).length === 32; } catch { return false; }
};

function validFields(o: Record<string, unknown>): RoomListingInput | null {
  if (typeof o.i !== 'string' || !ID.test(o.i)) return null;
  if (typeof o.n !== 'string' || !o.n || cleanRoomName(o.n) !== o.n) return null;
  if (typeof o.t !== 'string' || cleanRoomTopic(o.t) !== o.t) return null;
  if (!Array.isArray(o.g) || o.g.length > MAX_ROOM_TAGS) return null;
  const tags: string[] = [];
  for (const t of o.g) {
    if (typeof t !== 'string' || !ROOM_TAG_RE.test(t) || tags.includes(t)) return null;
    tags.push(t);
  }
  if (!validKey(o.k)) return null;
  if (typeof o.m !== 'number' || !Number.isInteger(o.m) || o.m < 1 || o.m > MAX_PUBLIC_ROOM_MEMBERS) return null;
  return { id: o.i, name: o.n, topic: o.t, tags, publicKey: o.k, members: o.m };
}

/** Plaintext listing memo; throws when a field is invalid or the memo would not fit one 256-byte memo. */
export function encodeListing(l: RoomListingInput): string {
  const fields = { i: l.id, n: l.name, t: l.topic, g: l.tags, k: l.publicKey, m: l.members };
  if (!validFields(fields)) throw new Error('Invalid room listing');
  const memo = ROOM_PREFIX + JSON.stringify(fields);
  if (utf8Len(memo) > MEMO_MAX_BYTES) throw new Error('Room name, topic and tags are too long together — shorten them');
  return memo;
}
export function encodeUnlist(id: string): string {
  if (!ID.test(id)) throw new Error('Invalid group id');
  return UNLIST_PREFIX + id;
}

export type RoomMemo = { kind: 'list'; listing: RoomListingInput } | { kind: 'unlist'; id: string };
export function parseRoomMemo(memo: string): RoomMemo | null {
  if (!memo.startsWith(ROOM_PREFIX) || utf8Len(memo) > MEMO_MAX_BYTES) return null;
  if (memo.startsWith(UNLIST_PREFIX)) {
    const id = memo.slice(UNLIST_PREFIX.length);
    return ID.test(id) ? { kind: 'unlist', id } : null;
  }
  let json: unknown;
  try { json = JSON.parse(memo.slice(ROOM_PREFIX.length)); } catch { return null; }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const listing = validFields(json as Record<string, unknown>);
  return listing ? { kind: 'list', listing } : null;
}

/** Both legs of the room fee carry the memo: 0.0080 CHEESE to eosio.null and 0.0020 CHEESE to xcheeseliqst. */
export const buildRoomActions = (from: string, memo: string, auth: unknown[]) => buildCryptFeeActions(from, ROOM_FEE_QUANTITY, auth, memo);

const paidNullLeg = (quantity: string) => {
  const m = /^(\d+)\.(\d{4}) CHEESE$/.exec(quantity.trim());
  return !!m && Number(m[1]) * 10000 + Number(m[2]) >= ROOM_NULL_UNITS;
};

/** Latest memo per (creator, room) wins; an unlist hides the room. Only paid eosio.null CHEESE legs count. Newest first. */
export function collectListings(transfers: ChainMemo[]): RoomListing[] {
  const latest = new Map<string, { time: number; listing: RoomListing | null }>();
  for (const t of transfers) {
    if (t.to !== KEY_PUBLISH_TO || !ACCOUNT.test(t.from) || !paidNullLeg(t.quantity)) continue;
    const r = parseRoomMemo(t.memo);
    if (!r) continue;
    const id = r.kind === 'list' ? r.listing.id : r.id;
    const k = `${t.from}:${id}`;
    const cur = latest.get(k);
    // Same-time ties keep the unlist, so a room is never shown by mistake.
    if (cur && (cur.time > t.time || (cur.time === t.time && (r.kind === 'list' || !cur.listing)))) continue;
    latest.set(k, { time: t.time, listing: r.kind === 'list' ? { ...r.listing, creator: t.from, time: t.time, txId: t.txId } : null });
  }
  return [...latest.values()].flatMap(x => x.listing ? [x.listing] : []).sort((a, b) => b.time - a.time);
}

export function searchListings(listings: RoomListing[], query: string): RoomListing[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return listings;
  return listings.filter(l => {
    const hay = `${l.name} ${l.topic} ${l.tags.join(' ')} ${l.creator}`.toLowerCase();
    return words.every(w => hay.includes(w.replace(/^#/, '')));
  });
}

/** Rooms I list now: the newer of my latest chain listing and my local list/unlist action wins. */
export function listedRoomIds(account: string, listings: RoomListing[], myRoomIds: string[], local: Record<string, LocalListing>): Set<string> {
  const chain = new Map(listings.filter(l => l.creator === account).map(l => [l.id, l.time]));
  const out = new Set<string>();
  for (const id of myRoomIds) {
    const c = chain.get(id), l = local[id];
    if (l && (c === undefined || l.at >= c) ? l.listed : c !== undefined) out.add(id);
  }
  return out;
}

/**
 * Separate decoding path for accounts that are not contacts: room creators I asked to join (their listing key)
 * and requesters to my listed rooms (their published key). Only complete CG2 envelopes come out; plain text,
 * voice, legacy groups and profile notes are never read here.
 */
export function decodeRoomEvents(memos: ChainMemo[], key: MessagingKey, peers: Record<string, string>): Cg2Event[] {
  const decoded = [];
  for (const m of memos) {
    const partner = m.from === key.account ? m.to : m.from;
    const pub = peers[partner];
    if (!pub || (m.from !== key.account && m.to !== key.account) || partner === key.account) continue;
    const bytes = decryptMemoBytes(m.memo, pub, key.secretKey);
    if (!bytes || bytes[0] === 3) continue;
    const text = bytesToText(bytes);
    if (text !== null) decoded.push({ ...m, text });
  }
  const out: Cg2Event[] = [];
  for (const m of assembleMessages(decoded)) {
    if (m.missing || !isCg2(m.text)) continue;
    const control = parseCg2(m.text);
    if (control) out.push({ key: m.key, txId: m.txId, time: m.time, from: m.from, to: m.to, control, usedKey: peers[m.from === key.account ? m.to : m.from] });
  }
  return out;
}

export interface JoinRequest { groupId: string; from: string; publicKey: string; time: number }
/** Join requests to my listed rooms from non-members, newest per (room, requester), after any decline. */
export function collectJoinRequests(events: Cg2Event[], me: string, listed: Set<string>, members: Record<string, string[]>, blocked: string[], declines: Record<string, number>): JoinRequest[] {
  const latest = new Map<string, JoinRequest>();
  for (const e of events) {
    if (e.control.kind !== 'join' || e.to !== me || e.from === me || !listed.has(e.control.id)) continue;
    const id = e.control.id;
    if (!members[id] || members[id].includes(e.from) || blocked.includes(e.from)) continue;
    const k = `${id}:${e.from}`;
    if (e.time <= (declines[k] ?? 0) || (latest.get(k)?.time ?? 0) > e.time) continue;
    latest.set(k, { groupId: id, from: e.from, publicKey: e.usedKey, time: e.time });
  }
  return [...latest.values()].sort((a, b) => b.time - a.time);
}

// ---- per-account device storage ----
export interface LocalListing { listed: boolean; at: number }
export interface RoomRequest extends RoomInviter { id: string; time: number }
const listedStore = (a: string) => `cheesecrypt-listed-rooms-${a}`;
const requestStore = (a: string) => `cheesecrypt-room-requests-${a}`;
const declineStore = (a: string) => `cheesecrypt-join-declines-${a}`;
const readObject = (k: string): Record<string, unknown> => {
  try { const raw: unknown = JSON.parse(localStorage.getItem(k) || '{}'); return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}; } catch { return {}; }
};
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

export function loadLocalListings(account: string): Record<string, LocalListing> {
  const out: Record<string, LocalListing> = {};
  for (const [id, v] of Object.entries(readObject(listedStore(account)))) {
    const o = v as Partial<LocalListing>;
    if (ID.test(id) && typeof o?.listed === 'boolean' && finite(o.at)) out[id] = { listed: o.listed, at: o.at };
  }
  return out;
}
export function saveLocalListing(account: string, id: string, listed: boolean, at = Date.now()) {
  const next = { ...loadLocalListings(account), [id]: { listed, at } };
  localStorage.setItem(listedStore(account), JSON.stringify(next));
  return next;
}
export function loadRoomRequests(account: string): Record<string, RoomRequest> {
  const out: Record<string, RoomRequest> = {};
  for (const [id, v] of Object.entries(readObject(requestStore(account)))) {
    const o = v as Partial<RoomRequest>;
    if (ID.test(id) && o?.id === id && typeof o.creator === 'string' && ACCOUNT.test(o.creator) && o.creator !== account && validKey(o.publicKey) && finite(o.time))
      out[id] = { id, creator: o.creator, publicKey: o.publicKey, time: o.time };
  }
  return out;
}
export function saveRoomRequest(account: string, l: Pick<RoomListing, 'id' | 'creator' | 'publicKey'>, time = Date.now()) {
  const next = { ...loadRoomRequests(account), [l.id]: { id: l.id, creator: l.creator, publicKey: l.publicKey, time } };
  localStorage.setItem(requestStore(account), JSON.stringify(next));
  return next;
}
export function loadJoinDeclines(account: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, t] of Object.entries(readObject(declineStore(account)))) if (/^[a-f0-9]{16}:[a-z1-5.]{1,12}$/.test(k) && finite(t)) out[k] = t;
  return out;
}
export function declineJoin(account: string, id: string, from: string, time: number) {
  const all = loadJoinDeclines(account), k = `${id}:${from}`;
  const next = { ...all, [k]: Math.max(all[k] ?? 0, time) };
  localStorage.setItem(declineStore(account), JSON.stringify(next));
  return next;
}
