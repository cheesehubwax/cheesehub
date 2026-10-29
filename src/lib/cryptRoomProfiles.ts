// CHEESECrypt room profile directory: names/pictures of public-room members that a newcomer
// receives from the room owner inside the admission transaction. Display-only, never identity:
// WAX accounts stay the identity, friends' own profile notes and local nicknames always win.
import { parseAvatar, type CryptAvatar } from '@/lib/cryptAvatar';
import { parseCryptName } from '@/lib/cryptNames';
import { memberKey, type Cg2Event, type InviteGroup, type RoomProfileEntry } from '@/lib/cryptInviteGroups';

/** `self`: the owner describing themself (authenticated); otherwise the owner vouches for another member. */
export interface RoomProfile { displayName?: string; avatar?: CryptAvatar; time: number; self: boolean }
export type RoomProfiles = Record<string, RoomProfile>;

/** A self-description beats an owner's account of someone; within the same kind the newest wins. */
const better = (a: RoomProfile, b: RoomProfile | undefined) => !b || (a.self !== b.self ? a.self : a.time > b.time);

/**
 * A member describing only themself to me: one entry about the sender, opened with the sender's own
 * room key. Works in any invite group (public or private); the WAX account stays the identity.
 */
export function isSelfRoomProfile(e: Cg2Event, invites: Record<string, InviteGroup>, me: string) {
  if (e.control.kind !== 'profiles' || e.to !== me || e.from === me) return false;
  const g = invites[e.control.id];
  return !!g && e.control.entries.length === 1 && e.control.entries[0].account === e.from
    && !!memberKey(g, me) && !!memberKey(g, e.from) && e.usedKey === memberKey(g, e.from);
}

/**
 * Directory entries I can use: (a) sent to me by the room's creator, opened with the creator's room key,
 * in the same transaction as that creator's admission of me to the room, and only about room members;
 * (b) a member's own self-description (isSelfRoomProfile). Callers drop muted/banned senders' traffic first.
 */
export function deriveRoomProfiles(events: readonly Cg2Event[], invites: Record<string, InviteGroup>, me: string): RoomProfiles {
  const out: RoomProfiles = {};
  for (const e of events) {
    if (e.control.kind !== 'profiles' || e.to !== me) continue;
    if (isSelfRoomProfile(e, invites, me)) {
      const entry = e.control.entries[0];
      const p: RoomProfile = { ...(entry.displayName ? { displayName: entry.displayName } : {}), ...(entry.avatar ? { avatar: entry.avatar } : {}), time: e.time, self: true };
      if (better(p, out[entry.account])) out[entry.account] = p;
      continue;
    }
    const roomId = e.control.id;
    const g = invites[roomId];
    if (!g || !g.publicRoom || e.from !== g.creator || e.usedKey !== memberKey(g, g.creator)) continue;
    if (!events.some(a => a.txId === e.txId && a.from === g.creator && a.to === me && a.usedKey === e.usedKey
      && a.control.kind === 'admission' && a.control.invite.id === roomId)) continue;
    for (const entry of e.control.entries) {
      if (entry.account === me || !memberKey(g, entry.account)) continue;
      const p: RoomProfile = { ...(entry.displayName ? { displayName: entry.displayName } : {}), ...(entry.avatar ? { avatar: entry.avatar } : {}), time: e.time, self: entry.account === e.from };
      if (better(p, out[entry.account])) out[entry.account] = p;
    }
  }
  return out;
}

export function mergeRoomProfiles(a: RoomProfiles, b: RoomProfiles): RoomProfiles {
  const out = { ...a };
  for (const [acct, p] of Object.entries(b)) if (better(p, out[acct])) out[acct] = p;
  return out;
}

const store = (account: string) => `cheesecrypt-room-profiles-${account}`;
export function loadRoomProfiles(account: string): RoomProfiles {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(store(account)) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: RoomProfiles = {};
    for (const [acct, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!/^[a-z1-5.]{1,12}$/.test(acct) || !v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      const avatar = parseAvatar(o.avatar), displayName = parseCryptName(o.displayName);
      if ((!avatar && !displayName) || typeof o.time !== 'number' || !Number.isFinite(o.time)) continue;
      out[acct] = { ...(displayName ? { displayName } : {}), ...(avatar ? { avatar } : {}), time: o.time, self: o.self === true };
    }
    return out;
  } catch { return {}; }
}
export const saveRoomProfiles = (account: string, p: RoomProfiles) => localStorage.setItem(store(account), JSON.stringify(p));

/**
 * What the owner sends a newcomer: owner first, then admins, founders and other members;
 * each member's best-known name/picture (friends' verified profiles before earlier room directories).
 */
export function roomProfileEntries(g: InviteGroup, owner: { account: string; displayName?: string; avatar?: CryptAvatar },
  names: Record<string, string>, avatars: Record<string, CryptAvatar>, known: RoomProfiles, priority: readonly string[] = []): RoomProfileEntry[] {
  const accounts = g.members.map(m => m.account);
  const ordered = [owner.account, ...priority.filter(a => accounts.includes(a)), ...accounts].filter((a, i, all) => all.indexOf(a) === i && accounts.includes(a));
  return ordered.flatMap(a => {
    const displayName = a === owner.account ? parseCryptName(owner.displayName) : parseCryptName(names[a]) ?? known[a]?.displayName;
    const avatar = a === owner.account ? parseAvatar(owner.avatar) : avatars[a] ?? known[a]?.avatar;
    return displayName || avatar ? [{ account: a, ...(displayName ? { displayName } : {}), ...(avatar ? { avatar } : {}) }] : [];
  });
}
