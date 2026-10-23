// CHEESECrypt invite groups (CG2). Everything travels inside ordinary encrypted CHEESECrypt messages,
// so on-chain an invite or notice looks like any other message between two people.
// Membership is fixed by the creator's invite; joined/left status comes only from authenticated notices.
// Legacy ad-hoc groups (CG1, cryptGroups.ts) are untouched and keep working side by side.
import nacl from 'tweetnacl';
import { decodeBase64 } from 'tweetnacl-util';
import {
  buildSendMessageActions, encryptMemo, MAX_MESSAGE_BYTES, MAX_PARTS, partCount, plaintextBytes, splitMessage, type MessagingKey,
} from '@/lib/cheeseCrypt';
import { parseAvatar, type CryptAvatar } from '@/lib/cryptAvatar';
import { parseCryptName } from '@/lib/cryptNames';

export const CG2_PREFIX = '\u0002CG2:';
export const MIN_INVITE_MEMBERS = 2;
export const MAX_INVITE_MEMBERS = 8; // including the creator
const ID = /^[a-f0-9]{16}$/;
const ACCOUNT = /^[a-z1-5.]{1,12}$/;
/** Voice notes name an invite group as `i<id>`; that never parses as a legacy group id. */
export const VOICE_REF_PREFIX = 'i';

export interface InviteMember { account: string; publicKey: string }
export interface InviteGroup { id: string; name: string; creator: string; created: number; members: InviteMember[]; avatar?: CryptAvatar }
export type Cg2Kind = 'invite' | 'msg' | 'joined' | 'leave' | 'meta' | 'friend' | 'friend-ok';
export type Cg2 =
  | { kind: 'invite'; invite: InviteGroup }
  | { kind: 'msg'; id: string; text: string }
  | { kind: 'joined' | 'leave' | 'friend' | 'friend-ok'; id: string }
  | { kind: 'meta'; id: string; name: string; avatar?: CryptAvatar };

const validPublicKey = (k: unknown): k is string => {
  if (typeof k !== 'string') return false;
  try { return decodeBase64(k).length === 32; } catch { return false; }
};

export const newInviteGroupId = (random: (n: number) => Uint8Array = nacl.randomBytes) =>
  Array.from(random(8), b => b.toString(16).padStart(2, '0')).join('');

export function validateInvite(raw: unknown): InviteGroup | null {
  const o = raw as { i?: unknown; n?: unknown; o?: unknown; c?: unknown; m?: unknown; a?: unknown } | null;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (typeof o.i !== 'string' || !ID.test(o.i)) return null;
  const name = parseCryptName(o.n);
  if (!name || name !== o.n) return null;
  if (typeof o.o !== 'string' || !ACCOUNT.test(o.o)) return null;
  if (typeof o.c !== 'number' || !Number.isSafeInteger(o.c) || o.c <= 0) return null;
  if (!Array.isArray(o.m) || o.m.length < MIN_INVITE_MEMBERS || o.m.length > MAX_INVITE_MEMBERS) return null;
  const seen = new Set<string>();
  const members: InviteMember[] = [];
  for (const entry of o.m) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [account, publicKey] = entry as unknown[];
    if (typeof account !== 'string' || !ACCOUNT.test(account) || seen.has(account) || !validPublicKey(publicKey)) return null;
    seen.add(account); members.push({ account, publicKey });
  }
  if (!seen.has(o.o)) return null;
  let avatar: CryptAvatar | undefined;
  if (o.a !== undefined) { avatar = parseAvatar({ version: 1, pixels: o.a }); if (!avatar) return null; }
  return { id: o.i, name, creator: o.o, created: o.c, members, ...(avatar ? { avatar } : {}) };
}

const wire = (kind: Cg2Kind, body: unknown) => `${CG2_PREFIX}${kind}:${JSON.stringify(body)}`;
const checkId = (id: string) => { if (!ID.test(id)) throw new Error('Invalid group id'); return id; };

export function encodeInvite(g: InviteGroup): string {
  const body = { i: g.id, n: g.name, o: g.creator, c: g.created, m: g.members.map(m => [m.account, m.publicKey]), ...(g.avatar ? { a: g.avatar.pixels } : {}) };
  if (!validateInvite(body)) throw new Error('Invalid group');
  return wire('invite', body);
}
export const encodeGroupText = (id: string, text: string) => wire('msg', { i: checkId(id), t: text });
export const encodeNotice = (kind: 'joined' | 'leave' | 'friend' | 'friend-ok', id: string) => wire(kind, { i: checkId(id) });
export function encodeMeta(id: string, name: string, avatar?: CryptAvatar): string {
  const n = parseCryptName(name);
  if (!n) throw new Error('Give the group a name');
  return wire('meta', { i: checkId(id), n, ...(avatar ? { a: avatar.pixels } : {}) });
}

export const isCg2 = (text: string | null | undefined) => !!text && text.startsWith(CG2_PREFIX);

/** Strict decode; anything malformed is null (and, being CG2-prefixed, never shown as chat text). */
export function parseCg2(text: string | null | undefined): Cg2 | null {
  if (!isCg2(text)) return null;
  const rest = text!.slice(CG2_PREFIX.length);
  const colon = rest.indexOf(':');
  if (colon < 0) return null;
  const kind = rest.slice(0, colon);
  let body: Record<string, unknown>;
  try { body = JSON.parse(rest.slice(colon + 1)); } catch { return null; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (kind === 'invite') { const invite = validateInvite(body); return invite ? { kind, invite } : null; }
  if (typeof body.i !== 'string' || !ID.test(body.i)) return null;
  const id = body.i;
  if (kind === 'msg') return typeof body.t === 'string' && body.t.trim() ? { kind, id, text: body.t } : null;
  if (kind === 'joined' || kind === 'leave' || kind === 'friend' || kind === 'friend-ok') return { kind, id };
  if (kind === 'meta') {
    const name = parseCryptName(body.n);
    if (!name || name !== body.n) return null;
    let avatar: CryptAvatar | undefined;
    if (body.a !== undefined) { avatar = parseAvatar({ version: 1, pixels: body.a }); if (!avatar) return null; }
    return { kind, id, name, ...(avatar ? { avatar } : {}) };
  }
  return null;
}

/** A decoded CG2 message plus the key that actually opened it (needed to check the sender). */
export interface Cg2Event { key: string; txId: string; time: number; from: string; to: string; control: Cg2; usedKey: string }

export const memberKey = (g: InviteGroup, account: string) => g.members.find(m => m.account === account)?.publicKey;

/**
 * Invite acceptance. The invite must come from its creator and name both sides with the keys in use.
 * Received: the creator must be my contact with the same key that opened it, and list my real key.
 * Sent (I'm the creator): it must list my real key and the recipient.
 */
export function inviteAcceptable(e: Cg2Event, me: string, myPublicKey: string, contacts: Record<string, string>): boolean {
  if (e.control.kind !== 'invite') return false;
  const g = e.control.invite;
  if (e.from !== g.creator || memberKey(g, me) !== myPublicKey || !memberKey(g, e.to)) return false;
  if (e.to === me) return !!contacts[e.from] && contacts[e.from] === e.usedKey && memberKey(g, e.from) === e.usedKey;
  return e.from === me && memberKey(g, e.to) === e.usedKey;
}

/** Non-invite events count only between two members of a known invite, opened with the partner's invite key. */
export function eventFromMember(e: Cg2Event, invites: Record<string, InviteGroup>, me: string): InviteGroup | null {
  if (e.control.kind === 'invite') return null;
  const g = invites[e.control.id];
  if (!g || !memberKey(g, e.from) || !memberKey(g, e.to) || (e.from !== me && e.to !== me)) return null;
  const partner = e.from === me ? e.to : e.from;
  return memberKey(g, partner) === e.usedKey ? g : null;
}

/** First valid invite per id wins (earliest chain time); later conflicting copies are ignored. */
export function collectInvites(events: Cg2Event[], me: string, myPublicKey: string, contacts: Record<string, string>, stored: Record<string, InviteGroup>): Record<string, InviteGroup> {
  const out: Record<string, InviteGroup> = { ...stored };
  for (const e of [...events].sort((a, b) => a.time - b.time)) {
    if (e.control.kind !== 'invite' || out[e.control.invite.id] || !inviteAcceptable(e, me, myPublicKey, contacts)) continue;
    out[e.control.invite.id] = e.control.invite;
  }
  return out;
}

export type MyStatus = 'invited' | 'joined' | 'declined' | 'left';
export interface LocalDecision { status: 'joined' | 'declined' | 'left'; at: number }
export interface InviteGroupView {
  invite: InviteGroup; name: string; avatar?: CryptAvatar; status: MyStatus; isCreator: boolean;
  /** Members currently in the group (creator, anyone whose newest notice is joined, or who spoke). */
  joined: string[];
  /** Members who have not joined (or have left). */
  pending: string[];
  /** Friend requests to me from members in this group that I haven't answered. */
  friendRequests: string[];
  /** Members I sent a friend request to here. */
  requested: string[];
  /** Members who accepted my friend request here. */
  accepted: string[];
}

export function deriveInviteGroups(events: Cg2Event[], invites: Record<string, InviteGroup>, me: string, local: Record<string, LocalDecision>): InviteGroupView[] {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  return Object.values(invites).map(g => {
    const state = new Map<string, { joined: boolean; at: number }>();
    state.set(g.creator, { joined: true, at: 0 });
    let meta: { name: string; avatar?: CryptAvatar; at: number } | null = null;
    const requestsIn = new Set<string>(), requested = new Set<string>(), accepted = new Set<string>();
    for (const e of sorted) {
      if (e.control.kind === 'invite' || e.control.id !== g.id || !eventFromMember(e, invites, me)) continue;
      const c = e.control;
      if (c.kind === 'joined' || c.kind === 'msg') {
        const prev = state.get(e.from);
        if (!prev || prev.at <= e.time) state.set(e.from, { joined: true, at: e.time });
      } else if (c.kind === 'leave') {
        state.set(e.from, { joined: false, at: e.time });
      } else if (c.kind === 'meta') {
        if (e.from === g.creator && (!meta || e.time >= meta.at)) meta = { name: c.name, avatar: c.avatar, at: e.time };
      } else if (c.kind === 'friend') {
        if (e.to === me) requestsIn.add(e.from); else requested.add(e.to);
      } else if (c.kind === 'friend-ok') {
        if (e.to === me && requested.has(e.from)) accepted.add(e.from);
        if (e.from === me) requestsIn.delete(e.to);
      }
    }
    const isCreator = g.creator === me;
    const mine = state.get(me);
    const decision = local[g.id];
    let status: MyStatus;
    if (decision && (!mine || decision.at >= mine.at || (isCreator && mine.at === 0))) status = decision.status;
    else if (mine) status = mine.joined ? 'joined' : 'left';
    else status = 'invited';
    if (isCreator && status === 'invited') status = 'joined';
    const joined = g.members.map(m => m.account).filter(a => a === me ? status === 'joined' : !!state.get(a)?.joined);
    return {
      invite: g, name: meta?.name ?? g.name, avatar: meta ? meta.avatar : g.avatar, status, isCreator, joined,
      pending: g.members.map(m => m.account).filter(a => !joined.includes(a)),
      friendRequests: [...requestsIn].filter(a => !accepted.has(a)), requested: [...requested], accepted: [...accepted],
    };
  });
}

/** Group keys for decryption: every member key of every known invite, scoped to that group. Never contacts. */
export interface ScopedKey { groupId: string; account: string; publicKey: string }
export function scopedKeys(invites: Record<string, InviteGroup>, me: string): ScopedKey[] {
  return Object.values(invites).flatMap(g => g.members.filter(m => m.account !== me).map(m => ({ groupId: g.id, account: m.account, publicKey: m.publicKey })));
}

/** Size of a group text once wrapped (JSON escaping can grow it). */
export function inviteTextSize(id: string, text: string) {
  return { parts: partCount(encodeGroupText(id, text)), maxBytes: MAX_MESSAGE_BYTES - plaintextBytes(encodeGroupText(id, '')), bytes: plaintextBytes(text) };
}

/**
 * One transaction: an encrypted copy of `payload` for every recipient, each copy paying 0.0010 CHEESE per part;
 * the platform fee (80% eosio.null / 20% xcheeseliqst) is paid once per part, on the first recipient's copy only.
 */
export function buildCg2Actions(key: MessagingKey, recipients: string[], keys: Record<string, string>, payload: string, auth: unknown[], hasNft = false) {
  if (!recipients.length) throw new Error('Nobody to send to yet.');
  if (new Set(recipients).size !== recipients.length || recipients.includes(key.account)) throw new Error('Invalid recipients.');
  if (recipients.some(r => !keys[r])) throw new Error('A member key is missing.');
  const parts = splitMessage(payload);
  if (parts.length > MAX_PARTS) throw new Error('Too long.');
  return recipients.flatMap((to, i) => buildSendMessageActions(key.account, to, parts.map(p => encryptMemo(p, keys[to], key.secretKey)), auth, hasNft, i === 0));
}

export const partsOf = (payload: string) => partCount(payload);

// ---- per-account storage: known invites and my own decisions (device-only) ----
const invitesStore = (a: string) => `cheesecrypt-invite-groups-${a}`;
const decisionsStore = (a: string) => `cheesecrypt-invite-decisions-${a}`;
const friendDecisionsStore = (a: string) => `cheesecrypt-invite-friend-decisions-${a}`;

export function loadInvites(account: string): Record<string, InviteGroup> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(invitesStore(account)) || '{}');
    const out: Record<string, InviteGroup> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const v of Object.values(raw)) {
      const g = validateInvite(v);
      if (g && memberKey(g, account)) out[g.id] = g;
    }
    return out;
  } catch { return {}; }
}
export function saveInvites(account: string, invites: Record<string, InviteGroup>) {
  const out: Record<string, unknown> = {};
  for (const g of Object.values(invites)) out[g.id] = { i: g.id, n: g.name, o: g.creator, c: g.created, m: g.members.map(m => [m.account, m.publicKey]), ...(g.avatar ? { a: g.avatar.pixels } : {}) };
  localStorage.setItem(invitesStore(account), JSON.stringify(out));
}

export function loadDecisions(account: string): Record<string, LocalDecision> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(decisionsStore(account)) || '{}');
    const out: Record<string, LocalDecision> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [id, v] of Object.entries(raw)) {
      const d = v as Partial<LocalDecision>;
      if (ID.test(id) && (d?.status === 'joined' || d?.status === 'declined' || d?.status === 'left') && typeof d.at === 'number' && Number.isFinite(d.at)) out[id] = { status: d.status, at: d.at };
    }
    return out;
  } catch { return {}; }
}
export function saveDecision(account: string, id: string, status: LocalDecision['status'], at = Date.now()) {
  const all = loadDecisions(account);
  all[checkId(id)] = { status, at };
  localStorage.setItem(decisionsStore(account), JSON.stringify(all));
  return all;
}

/** Friend requests I declined (`<groupId>:<account>`), so they stop showing. */
export function loadFriendDecisions(account: string): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(friendDecisionsStore(account)) || '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && /^[a-f0-9]{16}:[a-z1-5.]{1,12}$/.test(x)) : [];
  } catch { return []; }
}
export function declineFriendRequest(account: string, id: string, from: string) {
  const next = [...new Set([...loadFriendDecisions(account), `${checkId(id)}:${from}`])];
  localStorage.setItem(friendDecisionsStore(account), JSON.stringify(next));
  return next;
}
