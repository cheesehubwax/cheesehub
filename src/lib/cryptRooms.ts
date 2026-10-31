// CHEESECrypt public rooms. A creator may publish a plaintext listing for one of their invite (CG2) groups so
// others can find it and ask to join in an encrypted message. Only the room's name, topic, tags, member count,
// creator account and the creator's public key are public — never the member list or any message.
// Making a room public pays a 100.0000 CHEESE listing fee (80% eosio.null / 20% xcheeseliqst) to deter
// throwaway spam listings; updating a listed room's details and unlisting pay the normal
// 0.0100 CHEESE platform fee. Both fee legs carry the memo.
import { decodeBase64 } from 'tweetnacl-util';
import { parseCryptName } from '@/lib/cryptNames';
import {
  assembleMessages, bytesToText, buildCryptFeeActions, CRYPT_ROUTER_ACCOUNT, buildSendMessageActions, decryptMemoBytes, encryptMemo, KEY_PUBLISH_TO, MEMO_MAX_BYTES, MESSAGE_FEE_QUANTITY,
  messageCost, msgPrefixOf, type ChainMemo, type MessagingKey,
} from '@/lib/cheeseCrypt';
import { encodeNotice, JOIN_NOTE_MAX, isCg2, MAX_PUBLIC_ROOM_MEMBERS, parseCg2, type Cg2Event, type RoomInviter } from '@/lib/cryptInviteGroups';

export const ROOM_PREFIX = 'CRYPTROOM1:';
export const UNLIST_PREFIX = `${ROOM_PREFIX}unlist:`;
/** One-time, non-refundable anti-spam fee for making a room public (or re-listing after an unlist): 100.0000 CHEESE, split 80/20. */
export const LISTING_FEE_QUANTITY = '100.0000 CHEESE';
/** Fee for updating a listed room's details and for unlisting. */
export const ROOM_FEE_QUANTITY = MESSAGE_FEE_QUANTITY;
/** The eosio.null leg of a listing fee (80% of the room fee, in 0.0001 CHEESE units). */
export const ROOM_NULL_UNITS = Math.round(parseFloat(ROOM_FEE_QUANTITY) * 10000) * 4 / 5;
/** The eosio.null leg of the listing fee (80% of 100.0000 CHEESE, in 0.0001 CHEESE units). */
export const LISTING_FEE_NULL_UNITS = Math.round(parseFloat(LISTING_FEE_QUANTITY) * 10000) * 4 / 5;
export const MAX_ROOM_NAME = 32;
export const MAX_ROOM_TOPIC = 56;
export const MAX_ROOM_TAGS = 3;
export const ROOM_TAG_RE = /^[a-z0-9-]{1,10}$/;
const ID = /^[a-f0-9]{16}$/;
const ACCOUNT = /^[a-z1-5.]{1,12}$/;
const utf8Len = (s: string) => new TextEncoder().encode(s).length;

export interface RoomListingInput { id: string; name: string; topic: string; tags: string[]; publicKey: string; members: number; avatar?: string; creatorName?: string }

/** Description and tags typed when a room is created, kept on this device so listing can prefill them. */
const infoKey = (account: string) => `cheesecrypt-room-info-${account}`;
export type RoomInfo = { topic: string; tags: string[] };
export function loadRoomInfo(account: string): Record<string, RoomInfo> {
  try { const o = JSON.parse(localStorage.getItem(infoKey(account)) ?? '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
export function saveRoomInfo(account: string, id: string, info: RoomInfo) {
  const all = loadRoomInfo(account);
  all[id] = { topic: cleanRoomTopic(info.topic), tags: cleanTags(info.tags.join(' ')) };
  localStorage.setItem(infoKey(account), JSON.stringify(all));
}
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
  // Optional palette-index room picture (64 hex digits, data only).
  if (o.a !== undefined && (typeof o.a !== 'string' || !AVATAR_RE.test(o.a))) return null;
  if (o.u !== undefined && (!parseCryptName(o.u) || parseCryptName(o.u) !== o.u)) return null;
  return { id: o.i, name: o.n, topic: o.t, tags, publicKey: o.k, members: o.m, ...(typeof o.a === 'string' ? { avatar: o.a } : {}), ...(typeof o.u === 'string' ? { creatorName: o.u } : {}) };
}
const AVATAR_RE = /^[0-9a-f]{64}$/;

/** Plaintext listing memo; throws when a field is invalid or the memo would not fit one 256-byte memo.
 *  The room picture is optional and dropped when it would not fit alongside the text fields. */
export function encodeListing(l: RoomListingInput): string {
  const base = { i: l.id, n: l.name, t: l.topic, g: l.tags, k: l.publicKey, m: l.members, ...(l.creatorName !== undefined ? { u: l.creatorName } : {}) };
  if (!validFields(base)) throw new Error('Invalid room listing');
  if (l.avatar) {
    const withPic = { ...base, a: l.avatar };
    if (!validFields(withPic)) throw new Error('Invalid room picture');
    const memo = ROOM_PREFIX + JSON.stringify(withPic);
    if (utf8Len(memo) <= MEMO_MAX_BYTES) return memo;
  }
  const memo = ROOM_PREFIX + JSON.stringify(base);
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

/** Both legs of the room fee carry the memo, split 80% to eosio.null and 20% to xcheeseliqst.
 *  `quantity` is the 100.0000 CHEESE listing fee for a new listing or the 0.0100 CHEESE fee for an update/unlist. */
export const buildRoomActions = (from: string, memo: string, auth: unknown[], quantity = ROOM_FEE_QUANTITY) => buildCryptFeeActions(from, quantity, auth, memo);

const paidUnits = (quantity: string) => {
  const m = /^(\d+)\.(\d{4}) CHEESE$/.exec(quantity.trim());
  return m ? Number(m[1]) * 10000 + Number(m[2]) : 0;
};

/**
 * Active public listings, newest first. Only paid eosio.null CHEESE legs count. A room becomes listed only with
 * the 100.0000 CHEESE listing fee; a cheaper 0.0100 CHEESE listing memo counts only as an update while the room is listed,
 * so old cheaper listings and unpaid lookalikes never appear. An unlist (0.0100 CHEESE) hides the room and ends the
 * listing, so re-listing pays the listing fee again. Same-time ties keep the unlist, so a room is never shown by mistake.
 */
export function collectListings(transfers: ChainMemo[]): RoomListing[] {
  const events = transfers
    .map(t => ({ t, r: t.to === KEY_PUBLISH_TO && ACCOUNT.test(t.from) && t.from !== CRYPT_ROUTER_ACCOUNT ? parseRoomMemo(t.memo) : null, units: paidUnits(t.quantity) }))
    .filter((x): x is { t: ChainMemo; r: RoomMemo; units: number } => !!x.r && x.units >= ROOM_NULL_UNITS)
    .sort((a, b) => a.t.time - b.t.time || (a.r.kind === 'unlist' ? 1 : 0) - (b.r.kind === 'unlist' ? 1 : 0));
  const state = new Map<string, { paid: boolean; listing: RoomListing | null }>();
  for (const { t, r, units } of events) {
    const id = r.kind === 'list' ? r.listing.id : r.id;
    const k = `${t.from}:${id}`;
    if (r.kind === 'unlist') { state.set(k, { paid: false, listing: null }); continue; }
    const cur = state.get(k);
    if (units >= LISTING_FEE_NULL_UNITS || cur?.paid)
      state.set(k, { paid: true, listing: { ...r.listing, creator: t.from, time: t.time, txId: t.txId } });
  }
  return [...state.values()].flatMap(x => x.listing ? [x.listing] : []).sort((a, b) => b.time - a.time);
}

export function searchListings(listings: RoomListing[], query: string): RoomListing[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return listings;
  return listings.filter(l => {
    const hay = `${l.name} ${l.topic} ${l.tags.join(' ')} ${l.creator} ${l.creatorName ?? ''}`.toLowerCase();
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
  // A key carried inside a join memo is trusted only for that memo, and only if it yields a single-part join.
  const embedded = new Map<string, string>();
  for (const m of memos) {
    const partner = m.from === key.account ? m.to : m.from;
    if ((m.from !== key.account && m.to !== key.account) || partner === key.account) continue;
    const carried = m.to === key.account ? joinMemoKey(m.memo) : null;
    for (const pub of carried && carried !== peers[partner] ? [peers[partner], carried] : [peers[partner]]) {
      if (!pub) continue;
      const bytes = decryptMemoBytes(m.memo, pub, key.secretKey);
      if (!bytes || bytes[0] === 3) continue;
      const text = bytesToText(bytes);
      if (text === null) continue;
      if (pub !== peers[partner]) {
        // Self-introduced key: accept only a complete join notice, never any other control or text.
        if (!isCg2(text) || parseCg2(text)?.kind !== 'join') continue;
        embedded.set(`${m.txId}:${m.from}:${m.memo}`, pub);
      }
      decoded.push({ ...m, text });
      break;
    }
  }
  const out: Cg2Event[] = [];
  for (const m of assembleMessages(decoded)) {
    if (m.missing || !isCg2(m.text)) continue;
    const control = parseCg2(m.text);
    if (!control) continue;
    const viaEmbedded = decoded.find(d => d.txId === m.txId && d.from === m.from && embedded.has(`${d.txId}:${d.from}:${d.memo}`));
    const usedKey = viaEmbedded ? embedded.get(`${viaEmbedded.txId}:${viaEmbedded.from}:${viaEmbedded.memo}`)! : peers[m.from === key.account ? m.to : m.from];
    if (viaEmbedded && (control.kind !== 'join' || m.parts !== 1)) continue;
    out.push({ key: m.key, txId: m.txId, time: m.time, from: m.from, to: m.to, control, usedKey });
  }
  return out;
}

/**
 * Join requests carry the requester's public key after the ciphertext (`CRYPT1:<nonce>:<box>:<publicKey>`), so
 * people who never published a key can still ask to join. Older readers ignore the extra field. The key is only
 * shown to the room creator and is used for nothing but reading that join request and sending the invite.
 */
export function joinMemoKey(memo: string): string | null {
  const prefix = msgPrefixOf(memo);
  if (!prefix) return null;
  const fields = memo.slice(prefix.length).split(':');
  if (fields.length !== 3) return null;
  try { return decodeBase64(fields[2]).length === 32 ? fields[2] : null; } catch { return null; }
}

export function encodeJoinMemo(key: MessagingKey, roomId: string, creatorPublicKey: string, note?: string): string {
  const memo = `${encryptMemo(encodeNotice('join', roomId, note), creatorPublicKey, key.secretKey)}:${key.publicKey}`;
  if (new TextEncoder().encode(memo).length > MEMO_MAX_BYTES) throw new Error(`Join request note is too long — shorten it (up to ${JOIN_NOTE_MAX} plain characters; emoji take more room)`);
  return memo;
}

/** A join/rejoin request pays exactly the ordinary single-part direct-message fee. */
export const JOIN_REQUEST_COST = messageCost(1);

/** Encrypted request carrier to the creator plus the normal platform fee; no extra owner payment or identifying fee memo. */
export const buildJoinRequestActions = (key: MessagingKey, creator: string, creatorPublicKey: string, roomId: string, auth: unknown[], note?: string) =>
  buildSendMessageActions(key.account, creator, [encodeJoinMemo(key, roomId, creatorPublicKey, note)], auth, false, true);

export interface JoinRequest { groupId: string; from: string; publicKey: string; time: number; note?: string }
/** Join requests to my listed rooms from non-members, newest per (room, requester), after any decline. */
export function collectJoinRequests(events: Cg2Event[], me: string, listed: Set<string>, members: Record<string, string[]>, blocked: string[], declines: Record<string, number>): JoinRequest[] {
  const latest = new Map<string, JoinRequest>();
  for (const e of events) {
    if (e.control.kind !== 'join' || e.to !== me || e.from === me || !listed.has(e.control.id)) continue;
    const id = e.control.id;
    if (!members[id] || members[id].includes(e.from) || blocked.includes(e.from)) continue;
    const k = `${id}:${e.from}`;
    const handledAt = Math.max(0, ...events.filter(x => x.from === me && x.to === e.from && x.usedKey === e.usedKey && ((x.control.kind === 'admission' && x.control.invite.id === id) || (x.control.kind === 'readmit' && x.control.id === id && x.control.member === e.from))).map(x => x.time));
    const leftAt = Math.max(0, ...events.filter(x => x.from === e.from && x.to === me && x.usedKey === e.usedKey && x.control.kind === 'leave' && x.control.id === id).map(x => x.time));
    if (e.time <= Math.max(declines[k] ?? 0, handledAt, leftAt) || (latest.get(k)?.time ?? 0) > e.time) continue;
    latest.set(k, { groupId: id, from: e.from, publicKey: e.usedKey, time: e.time, ...(e.control.note ? { note: e.control.note } : {}) });
  }
  return [...latest.values()].sort((a, b) => b.time - a.time);
}

// ---- per-account device storage ----
export interface LocalListing { listed: boolean; at: number }
export interface RoomRequest extends RoomInviter { id: string; time: number; name?: string }
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
      out[id] = { id, creator: o.creator, publicKey: o.publicKey, time: o.time, ...(typeof o.name === 'string' && o.name.length <= 64 ? { name: o.name } : {}) };
  }
  return out;
}
export function saveRoomRequest(account: string, l: Pick<RoomListing, 'id' | 'creator' | 'publicKey'> & { name?: string }, time = Date.now()) {
  const next = { ...loadRoomRequests(account), [l.id]: { id: l.id, creator: l.creator, publicKey: l.publicKey, time, ...(l.name ? { name: l.name.slice(0, 64) } : {}) } };
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

/** Forget my request to a room (after I've seen its decline), so it leaves the Groups list. */
export function removeRoomRequest(account: string, id: string) {
  const next = { ...loadRoomRequests(account) };
  delete next[id];
  localStorage.setItem(requestStore(account), JSON.stringify(next));
  return next;
}

export type RoomRequestOutcome = 'pending' | 'accepted' | 'declined';
/**
 * The state of each of my own join requests: accepted once the creator's invite exists, declined when the creator
 * sent a `join-no` notice after the request (a newer request after a decline is pending again).
 */
export function roomRequestOutcomes(requests: Record<string, RoomRequest>, events: Cg2Event[], me: string, invited: Set<string>): Record<string, RoomRequestOutcome> {
  const out: Record<string, RoomRequestOutcome> = {};
  // Chain block time can trail the local clock slightly; a decline must still come after the request.
  const SKEW = 120_000;
  for (const r of Object.values(requests)) {
    if (invited.has(r.id)) { out[r.id] = 'accepted'; continue; }
    const declined = events.some(e => e.control.kind === 'join-no' && e.control.id === r.id && e.from === r.creator && e.to === me && e.time >= r.time - SKEW);
    out[r.id] = declined ? 'declined' : 'pending';
  }
  return out;
}

/** The owner's note on the answer to each of my join requests (from the admission or the newest decline after the request). */
export function roomRequestNotes(requests: Record<string, RoomRequest>, events: Cg2Event[], me: string, outcomes: Record<string, RoomRequestOutcome>): Record<string, string> {
  const out: Record<string, string> = {};
  const SKEW = 120_000;
  for (const r of Object.values(requests)) {
    const want = outcomes[r.id] === 'accepted' ? 'admission' : outcomes[r.id] === 'declined' ? 'join-no' : null;
    if (!want) continue;
    const latest = events.filter(e => e.from === r.creator && e.to === me && e.time >= r.time - SKEW && e.control.kind === want
      && (e.control.kind === 'admission' ? e.control.invite.id : (e.control as { id: string }).id) === r.id).sort((a, b) => b.time - a.time)[0];
    const note = latest && (latest.control as { note?: string }).note;
    if (note) out[r.id] = note;
  }
  return out;
}
