import nacl from 'tweetnacl';
import {
  assembleMessages, buildSendMessageActions, bytesToText, ChainMemo, decryptMemoBytes, encryptMemo, type AssembledMessage, type DecodedMemo,
  MAX_MESSAGE_BYTES, MESSAGE_FEE_QUANTITY, MESSAGE_RECIPIENT_QUANTITY, NFT_FEE_QUANTITY, MessagingKey, partCount, plaintextBytes, splitMessage,
} from '@/lib/cheeseCrypt';
import { assembleVoice, parseVoicePart, type VoiceNote, type VoicePartMemo } from '@/lib/cryptVoice';
import { isCg2, parseCg2, VOICE_REF_PREFIX, type Cg2, type ScopedKey } from '@/lib/cryptInviteGroups';

export interface CryptGroup { id: string; members: string[] }
const PREFIX = '\u0002CG1:';
const ACCOUNT = /^[a-z1-5.]{1,12}$/;

export function parseGroup(raw: unknown): CryptGroup | null {
  const g = raw as Partial<CryptGroup> | null;
  if (!g || typeof g.id !== 'string' || !/^[a-f0-9]{16}$/.test(g.id) || !Array.isArray(g.members)) return null;
  if (g.members.length < 3 || g.members.length > 6 || g.members.some(m => typeof m !== 'string' || !ACCOUNT.test(m))) return null;
  if (new Set(g.members).size !== g.members.length) return null;
  return { id: g.id, members: [...g.members].sort() };
}

export function createGroup(account: string, friends: string[]): CryptGroup {
  const id = Array.from(nacl.randomBytes(8), b => b.toString(16).padStart(2, '0')).join('');
  const group = parseGroup({ id, members: [account, ...friends] });
  if (!group) throw new Error('Select 2–5 different friends.');
  return group;
}

export function loadGroups(account: string): CryptGroup[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(`cheesecrypt-groups-${account}`) || '[]');
    return Array.isArray(raw) ? raw.map(parseGroup).filter((g): g is CryptGroup => !!g && g.members.includes(account)) : [];
  } catch { return []; }
}
export function saveGroups(account: string, groups: CryptGroup[]) {
  localStorage.setItem(`cheesecrypt-groups-${account}`, JSON.stringify(groups));
}

export function loadHiddenGroups(account: string): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(`cheesecrypt-hidden-groups-${account}`) || '[]');
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && /^[a-f0-9]{16}$/.test(id)) : [];
  } catch { return []; }
}

export function setGroupHidden(account: string, id: string, hidden: boolean) {
  if (!/^[a-f0-9]{16}$/.test(id)) return;
  const ids = new Set(loadHiddenGroups(account));
  if (hidden) ids.add(id); else ids.delete(id);
  localStorage.setItem(`cheesecrypt-hidden-groups-${account}`, JSON.stringify([...ids]));
}

export function groupPayload(group: CryptGroup, text: string): string {
  const valid = parseGroup(group);
  if (!valid) throw new Error('Invalid group.');
  return PREFIX + JSON.stringify({ ...valid, text });
}
export function groupMessageSize(group: CryptGroup, text: string) {
  const payload = groupPayload(group, text);
  return { parts: partCount(payload), maxBytes: MAX_MESSAGE_BYTES - plaintextBytes(groupPayload(group, '')), bytes: plaintextBytes(text) };
}

/** One shared platform fee per part, plus a payment to every recipient. */
export function groupMessageCost(parts: number, recipients: number, hasNft = false): string {
  const feeUnits = Math.round(parseFloat(MESSAGE_FEE_QUANTITY) * 10000);
  const recipientUnits = Math.round(parseFloat(MESSAGE_RECIPIENT_QUANTITY) * 10000);
  const nftExtra = hasNft ? Math.round(parseFloat(NFT_FEE_QUANTITY) * 10000) - feeUnits : 0;
  return `${(((feeUnits + recipientUnits * recipients) * parts + nftExtra) / 10000).toFixed(4)} CHEESE`;
}

export function buildGroupMessageActions(key: MessagingKey, group: CryptGroup, text: string, contacts: Record<string, string>, auth: unknown[], hasNft = false) {
  if (!text.trim()) throw new Error('Message is empty');
  const valid = parseGroup(group);
  if (!valid || !valid.members.includes(key.account)) throw new Error('You are not a member of this group.');
  const recipients = valid.members.filter(m => m !== key.account);
  if (recipients.some(m => !contacts[m])) throw new Error('Load every group member’s public key before sending.');
  const parts = splitMessage(groupPayload(valid, text));
  return recipients.flatMap((to, recipientIndex) => {
    return buildSendMessageActions(key.account, to,
      parts.map(p => encryptMemo(p, contacts[to], key.secretKey)), auth, hasNft, recipientIndex === 0);
  });
}

/**
 * `igroup`: an invite (CG2) group id. `control`: a CG2 notice/invite (never shown as chat text).
 * `usedKey`: the partner public key that opened this entry, so invite groups can check the sender.
 */
export type ConversationEntry = AssembledMessage & { group: CryptGroup | null; voice?: VoiceNote; igroup?: string; control?: Cg2; usedKey?: string };

/** True only for genuine 1-on-1 traffic: never a CG1 group envelope or a CG2 invite-group copy. */
export function isDirectMessage(m: ConversationEntry, account: string, other: string): boolean {
  if (m.group || m.igroup) return false;
  return (m.from === account && m.to === other) || (m.from === other && m.to === account);
}

/**
 * Only authenticated, fully reassembled envelopes can define a group.
 * `scoped` keys (introduced by invite groups) are tried only when the partner's contact key cannot open a memo,
 * and whatever they open must be invite-group traffic for exactly that group — never a direct message.
 */
export function decodeConversations(memos: ChainMemo[], key: MessagingKey, contacts: Record<string, string>, now = Date.now(), scoped: ScopedKey[] = []): ConversationEntry[] {
  // Decrypt once; bucket by which key opened the memo ('' = the contact key).
  const buckets = new Map<string, { usedKey: string | null; groupId: string | null; text: DecodedMemo[]; voice: VoicePartMemo[] }>();
  const bucket = (id: string, usedKey: string | null, groupId: string | null) => {
    let b = buckets.get(id);
    if (!b) { b = { usedKey, groupId, text: [], voice: [] }; buckets.set(id, b); }
    return b;
  };
  for (const m of memos) {
    if (m.from !== key.account && m.to !== key.account) continue;
    const partner = m.from === key.account ? m.to : m.from;
    let bytes = contacts[partner] ? decryptMemoBytes(m.memo, contacts[partner], key.secretKey) : null;
    let b = bucket(`c:${partner}`, contacts[partner] ?? null, null);
    if (!bytes) {
      for (const s of scoped) {
        if (s.account !== partner || s.publicKey === contacts[partner]) continue;
        const opened = decryptMemoBytes(m.memo, s.publicKey, key.secretKey);
        if (opened) { bytes = opened; b = bucket(`s:${s.groupId}:${partner}`, s.publicKey, s.groupId); break; }
      }
    }
    const part = bytes ? parseVoicePart(bytes) : null;
    if (part) b.voice.push({ txId: m.txId, time: m.time, from: m.from, to: m.to, part });
    else if (bytes || !b.groupId) b.text.push({ ...m, text: bytes ? bytesToText(bytes) : null });
  }
  const seen = new Set<string>();
  const texts: ConversationEntry[] = [];
  const voices = new Map<string, ConversationEntry>();
  for (const b of buckets.values()) {
    for (const m of assembleMessages(b.text)) {
      if (isCg2(m.text)) {
        if (m.missing || !b.usedKey) continue; // partial or unauthenticated CG2 data is never used
        const control = parseCg2(m.text);
        if (!control) continue;
        const id = (control.kind === 'invite' || control.kind === 'admission') ? control.invite.id : control.id;
        // A group key only opens its own group's notices (including that group's member updates from its creator).
        if (b.groupId && !scoped.some(s => s.groupId === id && s.account === (m.from === key.account ? m.to : m.from) && s.publicKey === b.usedKey)) continue;
        if (control.kind === 'msg') {
          const fanoutId = m.parts > 1 ? `cg2:${m.txId}:${m.from}:${id}:${m.key.split(':')[2]}` : `cg2:${m.txId}:${m.from}:${id}:${control.text}`;
          if (seen.has(fanoutId)) continue;
          seen.add(fanoutId);
          texts.push({ ...m, key: fanoutId, text: control.text, group: null, igroup: id, control, usedKey: b.usedKey });
        } else texts.push({ ...m, text: null, group: null, igroup: id, control, usedKey: b.usedKey });
        continue;
      }
      if (b.groupId) continue; // group-introduced keys never unlock direct or legacy-group messages
      if (!m.text?.startsWith(PREFIX)) { texts.push({ ...m, group: null as CryptGroup | null }); continue; }
      if (m.missing) continue; // partial metadata is never accepted as a group definition
      try {
        const raw = JSON.parse(m.text.slice(PREFIX.length));
        const group = parseGroup(raw);
        if (!group || typeof raw.text !== 'string' || !group.members.includes(key.account) || !group.members.includes(m.from) || !group.members.includes(m.to)) continue;
        // The sender sees a separate encrypted transfer copy per recipient.
        const id = `${m.txId}:${m.from}:${group.id}:${m.key}`;
        const fanoutId = m.parts > 1 ? id.replace(/:[^:]+$/, '') : `${m.txId}:${m.from}:${group.id}:${raw.text}`;
        if (seen.has(fanoutId)) continue;
        seen.add(fanoutId);
        texts.push({ ...m, key: fanoutId, text: raw.text as string, group });
      } catch { /* not a group envelope */ }
    }
    // Voice notes: one entry per note; a group note's per-recipient copies (seen by the sender) collapse into one.
    for (const n of assembleVoice(b.voice, now)) {
      let group: CryptGroup | null = null;
      let igroup: string | undefined;
      const ref = n.group?.id ?? '';
      if (n.isGroup && ref.startsWith(VOICE_REF_PREFIX)) {
        igroup = ref.slice(VOICE_REF_PREFIX.length);
        if (!/^[a-f0-9]{16}$/.test(igroup) || !b.usedKey || (b.groupId && !scoped.some(s => s.groupId === igroup && s.account === (n.from === key.account ? n.to : n.from) && s.publicKey === b.usedKey))) continue;
      } else {
        if (b.groupId) continue;
        if (n.isGroup) {
          group = n.group ? parseGroup(n.group) : null;
          // Without authenticated metadata a group note cannot be placed in a conversation.
          if (!group || !group.members.includes(key.account) || !group.members.includes(n.from) || !group.members.includes(n.to)) continue;
        }
      }
      const k = igroup ? `ivoice:${n.from}:${igroup}:${n.id}` : group ? `voice:${n.from}:${group.id}:${n.id}` : `voice:${n.key}`;
      const prev = voices.get(k);
      if (prev?.voice && prev.voice.received >= n.received) continue;
      voices.set(k, { key: k, txId: n.txId, time: n.time, from: n.from, to: n.to, text: null, parts: n.total, missing: n.missing, group, voice: n, ...(igroup ? { igroup, usedKey: b.usedKey! } : {}) });
    }
  }
  return [...texts, ...voices.values()].sort((a, b) => a.time - b.time);
}

export function mergeGroups(existing: CryptGroup[], incoming: CryptGroup[]): CryptGroup[] {
  const groups = new Map(existing.map(g => [g.id, g]));
  incoming.forEach(g => { if (!groups.has(g.id)) groups.set(g.id, g); });
  return [...groups.values()];
}