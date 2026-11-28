/**
 * Shared-key public rooms. A room message is sent once, to eosio.null, instead of one pairwise copy per member,
 * so the chain no longer shows the room's size or members on each send.
 *
 * Stealth: memos use the exact padded `CRYPT2:<nonce>:<box>` layout and length of ordinary messages
 * (nacl.secretbox and nacl.box share nonce and MAC sizes), and carry no room identifier.
 *
 * Authorship: each sender encrypts with a subkey derived from the room key, epoch and their own account.
 * Readers derive the subkey from the account that authorized the router action on chain, so a member holding
 * the room key still cannot post as anyone else: a forged copy is attributed to its real signer and fails to open.
 *
 * Keys reach members only pairwise, inside owner-authenticated CG2 `roomkey` controls.
 */
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64 } from 'tweetnacl-util';
import {
  assembleMessages, bytesToText, MAX_PARTS, MSG_PREFIX_V2, padPlaintext, splitMessage, unpadPlaintext,
  type ChainMemo, type DecodedMemo,
} from '@/lib/cheeseCrypt';
import type { ConversationEntry } from '@/lib/cryptGroups';
import { encodeGroupText, eventFromMember, memberKey, parseCg2, type Cg2Event, type InviteGroup } from '@/lib/cryptInviteGroups';

export const ROOM_STREAM_TO = 'eosio.null';
export interface RoomKey { room: string; epoch: number; key: string; /** chain time (ms) the owner sent it */ since: number }
export interface RoomKeyOff { room: string; epoch: number }

export const newRoomKeyBytes = (random: (n: number) => Uint8Array = nacl.randomBytes) => encodeBase64(random(32));

/** Per-sender subkey: SHA-512(label ‖ room key) truncated to 32 bytes. */
export function senderSubkey(rk: Pick<RoomKey, 'room' | 'epoch' | 'key'>, sender: string): Uint8Array {
  const label = decodeUTF8(`CHEESECrypt room v1|${rk.room}|${rk.epoch}|${sender}|`);
  const key = decodeBase64(rk.key);
  const input = new Uint8Array(label.length + key.length);
  input.set(label); input.set(key, label.length);
  return nacl.hash(input).slice(0, 32);
}

/** Seal one part (already within the normal plaintext size) as an ordinary-looking padded CRYPT2: memo. */
export function sealRoomPart(rk: RoomKey, sender: string, part: string): string {
  const nonce = nacl.randomBytes(24);
  const box = nacl.secretbox(padPlaintext(decodeUTF8(part)), nonce, senderSubkey(rk, sender));
  return `${MSG_PREFIX_V2}${encodeBase64(nonce)}:${encodeBase64(box)}`;
}

/** Room text as the memos of one send: the same CG2 `msg` payload and part split as pairwise traffic. */
export function sealRoomText(rk: RoomKey, sender: string, text: string): string[] {
  return splitMessage(encodeGroupText(rk.room, text), undefined, MAX_PARTS).map(p => sealRoomPart(rk, sender, p));
}

export function openRoomPart(memo: string, rk: RoomKey, sender: string): string | null {
  if (!memo.startsWith(MSG_PREFIX_V2)) return null;
  const [n, c, extra] = memo.slice(MSG_PREFIX_V2.length).split(':');
  if (!n || !c || extra !== undefined) return null;
  try {
    const nonce = decodeBase64(n);
    if (nonce.length !== 24) return null;
    const opened = nacl.secretbox.open(decodeBase64(c), nonce, senderSubkey(rk, sender));
    const bytes = opened && unpadPlaintext(opened);
    return bytes ? bytesToText(bytes) : null;
  } catch { return null; }
}

/**
 * Owner-sent room keys I hold, oldest first. Only the room's creator, writing to me with the roster-pinned
 * key pair, can deliver one; the first key seen per epoch wins so a replayed copy cannot replace it.
 */
export function collectRoomKeys(events: readonly Cg2Event[], invites: Record<string, InviteGroup>, me: string): RoomKey[] {
  const out = new Map<string, RoomKey>();
  for (const e of [...events].sort((a, b) => a.time - b.time)) {
    if (e.control.kind !== 'roomkey' || e.to !== me) continue;
    const g = eventFromMember(e, invites, me);
    if (!g || !g.publicRoom || e.from !== g.creator) continue;
    const id = `${g.id}:${e.control.epoch}`;
    if (!out.has(id)) out.set(id, { room: g.id, epoch: e.control.epoch, key: e.control.key, since: e.time });
  }
  return [...out.values()];
}

/** Keys I sent as owner (my own outgoing roomkey controls), for rooms I created. */
export function ownedRoomKeys(events: readonly Cg2Event[], invites: Record<string, InviteGroup>, me: string): RoomKey[] {
  const out = new Map<string, RoomKey>();
  for (const e of [...events].sort((a, b) => a.time - b.time)) {
    if (e.control.kind !== 'roomkey' || e.from !== me) continue;
    const g = invites[e.control.id];
    if (!g || g.creator !== me || !eventFromMember(e, invites, me)) continue;
    const id = `${g.id}:${e.control.epoch}`;
    if (!out.has(id)) out.set(id, { room: g.id, epoch: e.control.epoch, key: e.control.key, since: e.time });
  }
  return [...out.values()];
}

/** Authenticated incoming or outgoing owner controls; never trust local switch state. */
export function collectRoomKeyOffs(events: readonly Cg2Event[], invites: Record<string, InviteGroup>, me: string): RoomKeyOff[] {
  return events.flatMap(e => {
    if (e.control.kind !== 'roomkey-off') return [];
    const g = eventFromMember(e, invites, me);
    return g?.publicRoom && e.from === g.creator ? [{ room: g.id, epoch: e.control.epoch }] : [];
  });
}

/** Include retired epochs so re-enabling never reuses an old key's epoch. */
export function latestRoomKeyEpoch(room: string, keys: readonly RoomKey[], offs: readonly RoomKeyOff[]): number {
  return [...keys, ...offs].reduce((epoch, k) => k.room === room ? Math.max(epoch, k.epoch) : epoch, 0);
}

/** Newest sending key per room; an off control wins ties, while historical keys stay held. */
export function currentRoomKeys(keys: readonly RoomKey[], offs: readonly RoomKeyOff[] = []): Record<string, RoomKey> {
  const out: Record<string, RoomKey> = {};
  for (const k of keys) if (!out[k.room] || k.epoch > out[k.room].epoch) out[k.room] = k;
  for (const off of offs) if (out[off.room] && off.epoch >= out[off.room].epoch) delete out[off.room];
  return out;
}

/**
 * eosio.null stream copies opened with held room keys, as room chat entries from their chain sender to me,
 * shaped exactly like decodeConversations' CG2 `msg` entries. `usedKey` is the sender's roster key, so the
 * existing member, moderation, edit and unread checks apply unchanged. A copy counts only after its key's
 * delivery time, from a current member of that room; partial multi-part sends are never shown.
 */
export function decodeRoomStream(rows: readonly ChainMemo[], keys: readonly RoomKey[], invites: Record<string, InviteGroup>, me: string): ConversationEntry[] {
  const opened: (DecodedMemo & { room: string })[] = [];
  for (const r of rows) {
    if (r.to !== ROOM_STREAM_TO || !r.memo.startsWith(MSG_PREFIX_V2)) continue;
    for (const rk of keys) {
      const g = invites[rk.room];
      if (!g || !memberKey(g, r.from) || r.time < rk.since) continue;
      const text = openRoomPart(r.memo, rk, r.from);
      if (text == null) continue;
      opened.push({ ...r, to: me, text, room: rk.room });
      break;
    }
  }
  const out: ConversationEntry[] = [];
  const seen = new Set<string>();
  for (const m of assembleMessages(opened)) {
    if (m.missing || m.text == null) continue;
    const control = parseCg2(m.text);
    const src = opened.find(o => o.txId === m.txId && o.from === m.from);
    if (!src || control?.kind !== 'msg' || control.id !== src.room) continue;
    const usedKey = memberKey(invites[src.room], m.from);
    const key = `cg2r:${m.txId}:${m.from}:${src.room}:${m.key.split(':')[2] ?? ''}`;
    if (!usedKey || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...m, key, text: control.text, group: null, igroup: src.room, control, usedKey });
  }
  return out;
}
