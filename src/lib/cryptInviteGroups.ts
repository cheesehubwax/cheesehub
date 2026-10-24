// CHEESECrypt invite groups (CG2). Everything travels inside ordinary encrypted CHEESECrypt messages,
// so on-chain an invite or notice looks like any other message between two people.
// Membership is fixed by the creator's invite; joined/left status comes only from authenticated notices.
// Legacy ad-hoc groups (CG1, cryptGroups.ts) are untouched and keep working side by side.
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8 } from 'tweetnacl-util';
import {
  buildSendMessageActions, encryptMemo, MAX_MESSAGE_BYTES, MAX_PARTS, partCount, plaintextBytes, splitMessage, type MessagingKey,
} from '@/lib/cheeseCrypt';
import { parseAvatar, type CryptAvatar } from '@/lib/cryptAvatar';
import { parseCryptName } from '@/lib/cryptNames';

export const CG2_PREFIX = '\u0002CG2:';
export const MIN_INVITE_MEMBERS = 2;
export const MAX_INVITE_MEMBERS = 8; // including the creator
export const MAX_PUBLIC_ROOM_MEMBERS = 50;
export const MAX_MEMBERSHIP_PARTS = 35;
const ID = /^[a-f0-9]{16}$/;
const ACCOUNT = /^[a-z1-5.]{1,12}$/;
/** Voice notes name an invite group as `i<id>`; that never parses as a legacy group id. */
export const VOICE_REF_PREFIX = 'i';

export interface InviteMember { account: string; publicKey: string }
export interface InviteGroup { id: string; name: string; creator: string; created: number; members: InviteMember[]; avatar?: CryptAvatar; publicRoom?: boolean }
export const MUTE_MINUTES = [15, 60, 360, 1440] as const;
export type MuteMinutes = typeof MUTE_MINUTES[number];
export type Cg2Kind = 'invite' | 'admission' | 'add' | 'msg' | 'joined' | 'leave' | 'meta' | 'friend' | 'friend-ok' | 'join' | 'room' | 'mute' | 'ban' | 'policy' | 'admin' | 'collapse';
export type Cg2 =
  | { kind: 'invite'; invite: InviteGroup }
  | { kind: 'admission'; invite: InviteGroup }
  | { kind: 'add'; id: string; previous: string; count: number; member: InviteMember }
  | { kind: 'msg'; id: string; text: string }
  | { kind: 'room'; id: string; listed: boolean; protected: string[] }
  | { kind: 'mute'; id: string; member: string; minutes: MuteMinutes }
  | { kind: 'ban'; id: string; member: string }
  | { kind: 'policy'; id: string; protected: string[]; bans: string[]; mutes: [string, number, number][]; admins: string[] }
  /** Owner-only: appoint (`on`) or dismiss a public-room admin. */
  | { kind: 'admin'; id: string; member: string; on: boolean }
  /** Owner/admin: collapse the message by `member` whose edit digest (cryptEdits.editTarget) is `target`. */
  | { kind: 'collapse'; id: string; member: string; target: string }
  /** `join`: a request to a public room's creator (cryptRooms.ts); never a membership change by itself. */
  | { kind: 'joined' | 'leave' | 'friend' | 'friend-ok' | 'join'; id: string }
  | { kind: 'meta'; id: string; name: string; avatar?: CryptAvatar };

const validPublicKey = (k: unknown): k is string => {
  if (typeof k !== 'string') return false;
  try { return decodeBase64(k).length === 32; } catch { return false; }
};

export const newInviteGroupId = (random: (n: number) => Uint8Array = nacl.randomBytes) =>
  Array.from(random(8), b => b.toString(16).padStart(2, '0')).join('');

export function validateInvite(raw: unknown, publicRoom = false): InviteGroup | null {
  const o = raw as { i?: unknown; n?: unknown; o?: unknown; c?: unknown; m?: unknown; a?: unknown } | null;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (typeof o.i !== 'string' || !ID.test(o.i)) return null;
  const name = parseCryptName(o.n);
  if (!name || name !== o.n) return null;
  if (typeof o.o !== 'string' || !ACCOUNT.test(o.o)) return null;
  if (typeof o.c !== 'number' || !Number.isSafeInteger(o.c) || o.c <= 0) return null;
  if (!Array.isArray(o.m) || o.m.length < MIN_INVITE_MEMBERS || o.m.length > (publicRoom ? MAX_PUBLIC_ROOM_MEMBERS : MAX_INVITE_MEMBERS)) return null;
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
  return { id: o.i, name, creator: o.o, created: o.c, members, ...(avatar ? { avatar } : {}), ...(publicRoom ? { publicRoom: true } : {}) };
}

const wire = (kind: Cg2Kind, body: unknown) => `${CG2_PREFIX}${kind}:${JSON.stringify(body)}`;
const checkId = (id: string) => { if (!ID.test(id)) throw new Error('Invalid group id'); return id; };

export function encodeInvite(g: InviteGroup): string {
  const body = { i: g.id, n: g.name, o: g.creator, c: g.created, m: g.members.map(m => [m.account, m.publicKey]), ...(g.avatar ? { a: g.avatar.pixels } : {}) };
  if (!validateInvite(body)) throw new Error('Invalid group');
  return wire('invite', body);
}
export const rosterDigest = (g: InviteGroup) => Array.from(nacl.hash(decodeUTF8(JSON.stringify([g.id, g.creator, g.created, g.members.map(m => [m.account, m.publicKey])]))).slice(0, 32), b => b.toString(16).padStart(2, '0')).join('');
export function encodeAdmission(g: InviteGroup) {
  const body = { i: g.id, n: g.name, o: g.creator, c: g.created, m: g.members.map(m => [m.account, m.publicKey]), ...(g.avatar ? { a: g.avatar.pixels } : {}) };
  if (!validateInvite(body, true)) throw new Error('Invalid public room');
  return wire('admission', body);
}
export function encodeMemberAdd(g: InviteGroup, member: InviteMember) {
  const payload = wire('add', { i: g.id, h: rosterDigest(g), c: g.members.length, m: [member.account, member.publicKey] });
  if (!parseCg2(payload)) throw new Error('Invalid member');
  return payload;
}
export const encodeGroupText = (id: string, text: string) => wire('msg', { i: checkId(id), t: text });
export const encodeNotice = (kind: 'joined' | 'leave' | 'friend' | 'friend-ok' | 'join', id: string) => wire(kind, { i: checkId(id) });
export function encodeRoomPolicy(id: string, listed: boolean, protectedMembers: string[]) {
  if (!protectedMembers.length || protectedMembers.length > MAX_INVITE_MEMBERS || new Set(protectedMembers).size !== protectedMembers.length || protectedMembers.some(a => !ACCOUNT.test(a))) throw new Error('Invalid protected members');
  return wire('room', { i: checkId(id), l: listed, p: protectedMembers });
}
export function encodeModeration(id: string, member: string, minutes?: MuteMinutes) {
  if (!ACCOUNT.test(member) || (minutes !== undefined && !MUTE_MINUTES.includes(minutes))) throw new Error('Invalid moderation action');
  return minutes === undefined ? wire('ban', { i: checkId(id), a: member }) : wire('mute', { i: checkId(id), a: member, d: minutes });
}
export function encodePolicySnapshot(id: string, protectedMembers: string[], bans: string[], mutes: [string, number, number][], admins: string[] = []) {
  const payload = wire('policy', { i: checkId(id), p: protectedMembers, b: bans, u: mutes, ...(admins.length ? { d: admins } : {}) });
  if (!parseCg2(payload)) throw new Error('Invalid room policy');
  return payload;
}
export function encodeAdmin(id: string, member: string, on: boolean) {
  if (!ACCOUNT.test(member)) throw new Error('Invalid admin');
  return wire('admin', { i: checkId(id), a: member, e: on });
}
export function encodeCollapse(id: string, author: string, target: string) {
  if (!ACCOUNT.test(author) || !/^[a-f0-9]{64}$/.test(target)) throw new Error('Invalid collapse');
  return wire('collapse', { i: checkId(id), a: author, h: target });
}
export function encodeMeta(id: string, name: string, avatar?: CryptAvatar): string {
  const n = parseCryptName(name);
  if (!n) throw new Error('Give the group a name');
  return wire('meta', { i: checkId(id), n, ...(avatar ? { a: avatar.pixels } : {}) });
}

export const isCg2 = (text: string | null | undefined) => !!text && text.startsWith(CG2_PREFIX);

/** Strict decode; anything malformed is null (and, being CG2-prefixed, never shown as chat text). */
export function parseCg2(text: string | null | undefined): Cg2 | null {
  if (!text || !isCg2(text)) return null;
  const rest = text.slice(CG2_PREFIX.length);
  const colon = rest.indexOf(':');
  if (colon < 0) return null;
  const kind = rest.slice(0, colon);
  let body: Record<string, unknown>;
  try { body = JSON.parse(rest.slice(colon + 1)); } catch { return null; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (kind === 'invite' || kind === 'admission') { const invite = validateInvite(body, kind === 'admission'); return invite ? { kind, invite } : null; }
  if (typeof body.i !== 'string' || !ID.test(body.i)) return null;
  const id = body.i;
  if (kind === 'add') {
    if (typeof body.h !== 'string' || !/^[a-f0-9]{64}$/.test(body.h) || !Number.isInteger(body.c) || typeof body.c !== 'number' || body.c < 2 || body.c >= MAX_PUBLIC_ROOM_MEMBERS || !Array.isArray(body.m) || body.m.length !== 2 || typeof body.m[0] !== 'string' || !ACCOUNT.test(body.m[0]) || !validPublicKey(body.m[1])) return null;
    return { kind, id, previous: body.h, count: body.c, member: { account: body.m[0], publicKey: body.m[1] } };
  }
  if (kind === 'policy') {
    const accounts = (a: unknown): a is string[] => Array.isArray(a) && a.length <= MAX_PUBLIC_ROOM_MEMBERS && new Set(a).size === a.length && a.every(v => typeof v === 'string' && ACCOUNT.test(v));
    if (!accounts(body.p) || !body.p.length || !accounts(body.b) || body.b.some(a => (body.p as string[]).includes(a)) || !Array.isArray(body.u) || body.u.length > MAX_PUBLIC_ROOM_MEMBERS || body.u.some(u => !Array.isArray(u) || u.length !== 3 || typeof u[0] !== 'string' || !ACCOUNT.test(u[0]) || !Number.isSafeInteger(u[1]) || !Number.isSafeInteger(u[2]) || u[1] < 0 || !MUTE_MINUTES.some(d => u[2] - u[1] === d * 60_000))) return null;
    const admins = body.d === undefined ? [] : body.d;
    if (!accounts(admins) || admins.some(a => (body.b as string[]).includes(a))) return null;
    return { kind, id, protected: body.p, bans: body.b, mutes: body.u as [string, number, number][], admins };
  }
  if (kind === 'room') {
    if (typeof body.l !== 'boolean' || !Array.isArray(body.p) || !body.p.length || body.p.length > MAX_INVITE_MEMBERS || new Set(body.p).size !== body.p.length || body.p.some(a => typeof a !== 'string' || !ACCOUNT.test(a))) return null;
    return { kind, id, listed: body.l, protected: body.p as string[] };
  }
  if (kind === 'admin') return typeof body.a === 'string' && ACCOUNT.test(body.a) && typeof body.e === 'boolean' ? { kind, id, member: body.a, on: body.e } : null;
  if (kind === 'collapse') return typeof body.a === 'string' && ACCOUNT.test(body.a) && typeof body.h === 'string' && /^[a-f0-9]{64}$/.test(body.h) ? { kind, id, member: body.a, target: body.h } : null;
  if (kind === 'ban' || kind === 'mute') {
    if (typeof body.a !== 'string' || !ACCOUNT.test(body.a)) return null;
    if (kind === 'ban') return { kind, id, member: body.a };
    if (typeof body.d !== 'number' || !MUTE_MINUTES.some(d => d === body.d)) return null;
    return { kind, id, member: body.a, minutes: body.d as MuteMinutes };
  }
  if (kind === 'msg') return typeof body.t === 'string' && body.t.trim() ? { kind, id, text: body.t } : null;
  if (kind === 'joined' || kind === 'leave' || kind === 'friend' || kind === 'friend-ok' || kind === 'join') return { kind, id };
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

/** A public room I asked to join: only its listing creator, with the listing key, may invite me to it. */
export interface RoomInviter { creator: string; publicKey: string }

/** Semantic bootstrap validation is shared by membership and moderation replay. */
export function policySnapshotValid(c: Extract<Cg2, { kind: 'policy' }>, g: InviteGroup, at: number) {
  return c.protected.length <= MAX_INVITE_MEMBERS && c.protected.includes(g.creator) && c.protected.every(a => !!memberKey(g, a)) && c.bans.every(a => !!memberKey(g, a)) && c.mutes.every(([a, start]) => a !== g.creator && start <= at && !!memberKey(g, a)) && c.admins.every(a => a !== g.creator && !!memberKey(g, a));
}
export function roomPolicyValid(c: Extract<Cg2, { kind: 'room' }>, g: InviteGroup, protectedMembers: string[]) {
  return c.protected.includes(g.creator) && c.protected.length === protectedMembers.length && protectedMembers.every(a => c.protected.includes(a)) && c.protected.every(a => !!memberKey(g, a));
}

/**
 * Invite acceptance. The invite must come from its creator and name both sides with the keys in use.
 * Received: the creator must be my contact with the same key that opened it (or the creator of a public room
 * I asked to join, with that listing's key), and list my real key.
 * Sent (I'm the creator): it must list my real key and the recipient.
 */
export function inviteAcceptable(e: Cg2Event, me: string, myPublicKey: string, contacts: Record<string, string>, rooms: Record<string, RoomInviter> = {}): boolean {
  if (e.control.kind !== 'invite' && e.control.kind !== 'admission') return false;
  const g = e.control.invite;
  if (e.from !== g.creator || memberKey(g, me) !== myPublicKey || !memberKey(g, e.to)) return false;
  if (e.to === me) {
    if (memberKey(g, e.from) !== e.usedKey) return false;
    if (!!contacts[e.from] && contacts[e.from] === e.usedKey) return true;
    const room = rooms[g.id];
    return !!room && room.creator === e.from && room.publicKey === e.usedKey;
  }
  return e.from === me && memberKey(g, e.to) === e.usedKey;
}

/**
 * A creator may only grow a known group: same id, creator, creation time and name, every existing member kept
 * with the same key, and the copy opened with the creator's key from the group I already hold (or, for my own
 * sent copies, the recipient's key in the update). Nobody can be removed or have their key swapped.
 */
export function inviteUpdateAcceptable(e: Cg2Event, current: InviteGroup, me: string, myPublicKey: string): boolean {
  if (e.control.kind !== 'invite' && e.control.kind !== 'admission') return false;
  const g = e.control.invite;
  if (g.id !== current.id || g.creator !== current.creator || g.created !== current.created || g.name !== current.name || e.from !== current.creator) return false;
  if (g.members.length <= current.members.length || memberKey(g, me) !== myPublicKey || !memberKey(g, e.to)) return false;
  if (current.members.some(m => memberKey(g, m.account) !== m.publicKey)) return false;
  if (e.to === me) return memberKey(current, e.from) === e.usedKey;
  return e.from === me && memberKey(g, e.to) === e.usedKey;
}

/** Non-invite events count only between two members of a known invite, opened with the partner's invite key. */
export function eventFromMember(e: Cg2Event, invites: Record<string, InviteGroup>, me: string): InviteGroup | null {
  if ((e.control.kind === 'invite' || e.control.kind === 'admission')) return null;
  const g = invites[e.control.id];
  if (!g || !memberKey(g, e.from) || !memberKey(g, e.to) || (e.from !== me && e.to !== me)) return null;
  const partner = e.from === me ? e.to : e.from;
  return memberKey(g, partner) === e.usedKey ? g : null;
}

/**
 * First valid invite per id wins (earliest chain time). A later copy only counts when it is the creator adding
 * members (inviteUpdateAcceptable); any other conflicting copy is ignored. Updates keep the stored name/picture.
 */
export function collectInvites(events: Cg2Event[], me: string, myPublicKey: string, contacts: Record<string, string>, stored: Record<string, InviteGroup>, rooms: Record<string, RoomInviter> = {}): Record<string, InviteGroup> {
  const out: Record<string, InviteGroup> = { ...stored };
  const protectedRosters: Record<string, string[]> = {};
  for (const e of [...events].sort((a, b) => a.time - b.time)) {
    const g = e.control.kind === 'invite' || e.control.kind === 'admission' ? e.control.invite : out[e.control.id];
    if (!g || e.from !== g.creator || !eventFromMember(e, { [g.id]: g }, me)) continue;
    if (e.control.kind === 'policy' && policySnapshotValid(e.control, g, e.time) && events.some(i => i.txId === e.txId && i.to === me && i.from === g.creator && i.control.kind === 'admission' && i.control.invite.id === g.id)) protectedRosters[g.id] ??= e.control.protected;
    if (e.control.kind === 'room' && e.control.protected.includes(me) && !protectedRosters[g.id]) {
      const earlier = events.filter(i => i.time <= e.time && i.txId !== e.txId && i.from === g.creator && i.control.kind === 'invite' && i.control.invite.id === g.id);
      const before = earlier.flatMap(i => i.control.kind === 'invite' ? i.control.invite.members.map(m => m.account) : []);
      const original = before.length ? [...new Set(before)] : !g.publicRoom ? g.members.map(m => m.account) : undefined;
      if (original && roomPolicyValid(e.control, g, original)) protectedRosters[g.id] = e.control.protected;
    }
  }
  const pending = [...events].sort((a, b) => a.time - b.time || a.txId.localeCompare(b.txId));
  // Replay until every predecessor available in this window has been applied.
  for (let pass = 0; pass < MAX_PUBLIC_ROOM_MEMBERS; pass++) {
    let changed = false;
    for (const e of pending) {
      const c = e.control;
      if (c.kind === 'add') {
        const g = out[c.id];
        if (!g || e.from !== g.creator || !eventFromMember(e, out, me) || c.count !== g.members.length || c.previous !== rosterDigest(g) || g.members.some(m => m.account === c.member.account)) continue;
        const original = protectedRosters[g.id] ?? (!g.publicRoom && g.members.length <= MAX_INVITE_MEMBERS ? g.members.map(m => m.account) : undefined);
        const policies = events.filter(p => original && p.txId === e.txId && p.from === g.creator && p.control.kind === 'room' && p.control.id === g.id && p.control.listed && roomPolicyValid(p.control, g, original) && eventFromMember(p, out, me));
        if (!policies.length) continue;
        if (original) protectedRosters[g.id] = original;
        const forks = pending.filter(p => p.control.kind === 'add' && p.control.id === c.id && p.control.previous === c.previous && p.from === g.creator && eventFromMember(p, out, me));
        if (new Set(forks.map(p => p.control.kind === 'add' ? JSON.stringify(p.control.member) : '')).size !== 1) continue;
        out[g.id] = { ...g, publicRoom: true, members: [...g.members, c.member] }; changed = true;
      } else if (c.kind === 'invite' || c.kind === 'admission') {
        const id = c.invite.id, current = out[id];
        // Public bootstraps only establish the requested room, never replace an existing roster.
        if (c.kind === 'admission' && (current || !rooms[id] || !events.some(p => p.txId === e.txId && p.from === e.from && p.to === me && p.usedKey === e.usedKey && p.control.kind === 'policy' && p.control.id === id && policySnapshotValid(p.control, c.invite, e.time)))) continue;
        if (c.kind === 'admission') {
          const bootstrap = events.find(p => p.txId === e.txId && p.from === e.from && p.to === me && p.control.kind === 'policy' && p.control.id === id);
          if (bootstrap?.control.kind === 'policy') protectedRosters[id] = bootstrap.control.protected;
        }
        if (!current) { if (inviteAcceptable(e, me, myPublicKey, contacts, rooms)) { out[id] = c.invite; changed = true; } continue; }
        if (c.kind === 'invite' && inviteUpdateAcceptable(e, current, me, myPublicKey)) { out[id] = { ...current, members: c.invite.members }; changed = true; }
      }
    }
    if (!changed) break;
  }
  return out;
}

/** Stable comparison of two invite stores (ids and member keys), so membership growth gets saved. */
export const invitesSignature = (invites: Record<string, InviteGroup>) =>
  Object.values(invites).map(g => `${g.id}:${!!g.publicRoom}=${g.members.map(m => `${m.account}:${m.publicKey}`).join(',')}`).sort().join('|');

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
      if ((e.control.kind === 'invite' || e.control.kind === 'admission') || e.control.id !== g.id || !eventFromMember(e, invites, me)) continue;
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
 * One transaction: an encrypted copy of `payload` for every recipient, each copy paying 0.0001 CHEESE per part;
 * the platform fee (80% eosio.null / 20% xcheeseliqst) is paid once per part, on the first recipient's copy only.
 */
export function buildCg2Actions(key: MessagingKey, recipients: string[], keys: Record<string, string>, payload: string, auth: unknown[], hasNft = false) {
  if (!recipients.length) throw new Error('Nobody to send to yet.');
  if (new Set(recipients).size !== recipients.length || recipients.includes(key.account)) throw new Error('Invalid recipients.');
  if (recipients.some(r => !keys[r])) throw new Error('A member key is missing.');
  const parts = splitMessage(payload, undefined, parseCg2(payload)?.kind === 'admission' ? MAX_MEMBERSHIP_PARTS : MAX_PARTS);
  if (parts.length > MAX_MEMBERSHIP_PARTS) throw new Error('Too long.');
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
      const g = validateInvite(v, !!(v && typeof v === 'object' && 'r' in v && v.r === true));
      if (g && memberKey(g, account)) out[g.id] = g;
    }
    return out;
  } catch { return {}; }
}
export function saveInvites(account: string, invites: Record<string, InviteGroup>) {
  const out: Record<string, unknown> = {};
  for (const g of Object.values(invites)) out[g.id] = { i: g.id, n: g.name, o: g.creator, c: g.created, m: g.members.map(m => [m.account, m.publicKey]), ...(g.avatar ? { a: g.avatar.pixels } : {}), ...(g.publicRoom ? { r: true } : {}) };
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
