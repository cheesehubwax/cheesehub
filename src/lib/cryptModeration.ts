import type { ChainMemo } from '@/lib/cheeseCrypt';
import type { ConversationEntry } from '@/lib/cryptGroups';
import { eventFromMember, policySnapshotValid, roomPolicyValid, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';
import { encodeReply, parseReply } from '@/lib/cryptReply';
import { editTarget } from '@/lib/cryptEdits';

export interface RoomModeration {
  listed: boolean; protected: string[]; bans: Record<string, number>;
  mutes: Record<string, { from: number; until: number }[]>;
  /** Current owner-appointed admins (replayed in chain order, so authority is checked at each control's time). */
  admins: string[];
  /** `${author}:${editTarget}` → first valid collapse. */
  collapses: Record<string, { by: string; at: number }>;
}
export type ModRole = 'owner' | 'admin' | 'member';
/** Owner: mute, ban (not founders), collapse anything, appoint admins. Admin: mute anyone but the owner;
 * collapse only post-public members' messages; never ban or appoint. Muted/removed admins act as members. */
export function roomRole(state: RoomModeration | undefined, g: InviteGroup, account: string, at: number): ModRole {
  if (account === g.creator) return 'owner';
  return state?.listed && state.admins.includes(account) && !restrictedAt(state, account, at) ? 'admin' : 'member';
}
export function canCollapseAuthor(state: RoomModeration | undefined, g: InviteGroup, mod: string, author: string, at: number) {
  const role = roomRole(state, g, mod, at);
  if (!state?.listed || !g.members.some(m => m.account === author)) return false;
  return role === 'owner' || (role === 'admin' && author !== g.creator && !state.protected.includes(author));
}
export function canMuteMember(state: RoomModeration | undefined, g: InviteGroup, mod: string, target: string, at: number) {
  const role = roomRole(state, g, mod, at);
  return target !== g.creator && target !== mod && g.members.some(m => m.account === target) && (role === 'owner' || (role === 'admin' && !!state?.listed));
}
/** Owner controls are authenticated pairwise copies. The first public roster is immutable across relistings.
 * A membership update carries the original policy to new members. Missing policy means no bans,
 * never an inferred unprotected roster. Controls use blockchain time, not device-time claims. */
export function deriveModeration(events: Cg2Event[], invites: Record<string, InviteGroup>, me: string): Record<string, RoomModeration> {
  const out: Record<string, RoomModeration> = {};
  const seen = new Set<string>();
  const priority = (e: Cg2Event) => e.control.kind === 'policy' ? 0 : e.control.kind === 'room' ? 1 : 2;
  for (const e of [...events].sort((a, b) => a.time - b.time || a.txId.localeCompare(b.txId) || priority(a) - priority(b))) {
    const g = eventFromMember(e, invites, me);
    if (!g) continue;
    const c = e.control;
    if (c.kind !== 'room' && c.kind !== 'mute' && c.kind !== 'ban' && c.kind !== 'policy' && c.kind !== 'admin' && c.kind !== 'collapse') continue;
    // Only mutes and collapses may come from an admin; everything else is owner-only.
    if (e.from !== g.creator && c.kind !== 'mute' && c.kind !== 'collapse') continue;
    const fingerprint = `${g.id}:${e.txId}:${JSON.stringify(c)}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    let state = out[g.id];
    if (c.kind === 'policy') {
      // A bootstrap snapshot is only for a recipient whose first invite is in this transaction.
      // Existing members always retain their own original event history and ignore the snapshot.
      const myInvites = events.filter(x => (x.control.kind === 'invite' || x.control.kind === 'admission') && x.control.invite.id === g.id && x.from === g.creator && x.to === me);
      if (state || !myInvites.some(x => x.txId === e.txId) || myInvites.some(x => x.time < e.time) || !policySnapshotValid(c, g, e.time)) continue;
      state = { listed: true, protected: [...c.protected], bans: Object.fromEntries(c.bans.map(a => [a, e.time])), mutes: {}, admins: [...c.admins], collapses: {} };
      for (const [a, from, until] of c.mutes) state.mutes[a] = [...(state.mutes[a] ?? []), { from, until }];
      out[g.id] = state;
      continue;
    }
    if (c.kind === 'room') {
      if (!c.protected.includes(g.creator) || c.protected.some(a => !g.members.some(m => m.account === a))) continue;
      // Without a verified newcomer bootstrap, never let a first policy strip my own immunity.
      if (!state && !c.protected.includes(me)) continue;
      if (state && !roomPolicyValid(c, g, state.protected)) continue;
      // Any pre-policy roster received on chain must be included, even if the creator tries omitting it.
      const before = events.filter(x => (x.control.kind === 'invite' || x.control.kind === 'admission') && x.control.invite.id === g.id && x.from === g.creator && x.time <= e.time && x.txId !== e.txId && eventInviteTrusted(x, g, me));
      if (!state && before.some(x => (x.control.kind === 'invite' || x.control.kind === 'admission') && x.control.invite.members.some(m => !c.protected.includes(m.account)))) continue;
      if (!state) { state = { listed: c.listed, protected: [...c.protected], bans: {}, mutes: {}, admins: [], collapses: {} }; out[g.id] = state; }
      else state.listed = c.listed;
      continue;
    }
    if (!state?.listed || !g.members.some(m => m.account === c.member)) continue;
    if (c.kind === 'collapse') {
      if (!canCollapseAuthor(state, g, e.from, c.member, e.time)) continue;
      state.collapses[`${c.member}:${c.target}`] ??= { by: e.from, at: e.time };
      continue;
    }
    if (c.member === g.creator) continue;
    if (c.kind === 'admin') {
      if (c.on && state.bans[c.member] === undefined && !state.admins.includes(c.member)) state.admins.push(c.member);
      if (!c.on) state.admins = state.admins.filter(a => a !== c.member);
      continue;
    }
    if (c.kind === 'ban') {
      if (!state.protected.includes(c.member)) { state.bans[c.member] = Math.min(state.bans[c.member] ?? Infinity, e.time); state.admins = state.admins.filter(a => a !== c.member); }
    } else {
      if (!canMuteMember(state, g, e.from, c.member, e.time)) continue;
      const intervals = state.mutes[c.member] ?? [];
      intervals.push({ from: e.time, until: e.time + c.minutes * 60_000 });
      state.mutes[c.member] = intervals;
    }
  }
  return out;
}
/** Founding members excluding the owner. A listed room without a received roster policy (e.g. listed before
 * policies existed) treats every current member as protected, matching the ban rules. Unlisted rooms show none. */
export function founderBadges(state: RoomModeration | undefined, g: InviteGroup, listed: boolean): string[] {
  const roster = state ? state.protected : listed ? g.members.map(m => m.account) : [];
  return roster.filter(a => a !== g.creator);
}
export function restrictedAt(state: RoomModeration | undefined, member: string, at: number) {
  return !!state && ((state.bans[member] !== undefined && at >= state.bans[member]) || !!state.mutes[member]?.some(m => at >= m.from && at < m.until));
}
function eventInviteTrusted(e: Cg2Event, g: InviteGroup, me: string) {
  const partner = e.from === me ? e.to : e.from;
  return (e.from === me || e.to === me) && g.members.find(m => m.account === partner)?.publicKey === e.usedKey;
}
function restrictedSpan(state: RoomModeration | undefined, member: string, start: number, end: number) {
  return restrictedAt(state, member, start) || restrictedAt(state, member, end) || !!state?.mutes[member]?.some(m => start < m.until && end >= m.from);
}
export function mutedUntil(state: RoomModeration | undefined, member: string, now: number) {
  return Math.max(0, ...(state?.mutes[member] ?? []).filter(m => now >= m.from && now < m.until).map(m => m.until));
}
/** Filter before edits and again after them; stripped reply quotes cannot expose hidden originals. */
export function moderateMessages<T extends ConversationEntry>(entries: T[], states: Record<string, RoomModeration>): T[] {
  return entries.filter(m => !m.igroup || !restrictedSpan(states[m.igroup], m.from, m.time, m.voice?.completedAt ?? m.time)).map(m => {
    const reply = parseReply(m.text);
    if (!m.igroup || !reply || !restrictedAt(states[m.igroup], reply.author, reply.time)) return m;
    return { ...m, text: encodeReply({ ...reply, quote: '' }, reply.body) };
  });
}
/** Collapses target the authenticated original (pre-edit) row, so compute them before applying edits. */
export function collapsedKeys(originals: ConversationEntry[], states: Record<string, RoomModeration>) {
  const out = new Map<string, { by: string; at: number }>();
  for (const m of originals) {
    const c = m.igroup ? states[m.igroup]?.collapses[`${m.from}:${editTarget(m)}`] : undefined;
    if (c && m.time <= c.at) out.set(m.key, c);
  }
  return out;
}
/** Marks collapsed rows and strips reply quotes of collapsed originals so a quote cannot reveal them. */
export function applyCollapses<T extends ConversationEntry>(entries: T[], collapsed: Map<string, { by: string; at: number }>): (T & { collapsed?: { by: string; at: number } })[] {
  const hidden = new Set(entries.filter(m => collapsed.has(m.key)).map(m => `${m.igroup}:${m.from}:${m.time}`));
  return entries.map(m => {
    const c = collapsed.get(m.key);
    const reply = parseReply(m.text);
    const text = m.igroup && reply && reply.quote && hidden.has(`${m.igroup}:${reply.author}:${reply.time}`) ? encodeReply({ ...reply, quote: '' }, reply.body) : m.text;
    return c ? { ...m, text, collapsed: c } : text === m.text ? m : { ...m, text };
  });
}
// Retain only encrypted moderation/invite controls already authenticated by the caller. History windows
// may move forward; mutes must not disappear when old transfers fall outside that window.
const store = (account: string) => `cheesecrypt-room-controls-${account}`;
export function loadModerationMemos(account: string): ChainMemo[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(store(account)) || '[]');
    return Array.isArray(raw) ? raw.filter((m): m is ChainMemo => !!m && typeof m === 'object' && typeof m.txId === 'string' && typeof m.memo === 'string' && typeof m.from === 'string' && typeof m.to === 'string' && typeof m.quantity === 'string' && Number.isFinite(m.time) && (m.from === account || m.to === account)) : [];
  } catch { return []; }
}
export function mergeModerationMemos(old: ChainMemo[], incoming: ChainMemo[]) {
  return [...new Map([...old, ...incoming].map(m => [`${m.txId}:${m.from}:${m.to}:${m.memo}`, m])).values()];
}
export function saveModerationMemos(account: string, memos: ChainMemo[]) {
  localStorage.setItem(store(account), JSON.stringify(memos));
}