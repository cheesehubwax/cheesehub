import nacl from 'tweetnacl';
import {
  assembleMessages, buildSendMessageActions, bytesToText, ChainMemo, decryptMemoBytes, encryptMemo, type AssembledMessage, type DecodedMemo,
  MAX_MESSAGE_BYTES, MESSAGE_FEE_QUANTITY, MESSAGE_RECIPIENT_QUANTITY, NFT_FEE_QUANTITY, MessagingKey, partCount, plaintextBytes, splitMessage,
} from '@/lib/cheeseCrypt';
import { assembleVoice, parseVoicePart, type VoiceNote, type VoicePartMemo } from '@/lib/cryptVoice';

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

export type ConversationEntry = AssembledMessage & { group: CryptGroup | null; voice?: VoiceNote };

/** Only authenticated, fully reassembled envelopes can define a group. */
export function decodeConversations(memos: ChainMemo[], key: MessagingKey, contacts: Record<string, string>, now = Date.now()): ConversationEntry[] {
  const textMemos: DecodedMemo[] = [];
  const voiceParts: VoicePartMemo[] = [];
  for (const m of memos) {
    if (m.from !== key.account && m.to !== key.account) continue;
    const partner = m.from === key.account ? m.to : m.from;
    const bytes = contacts[partner] ? decryptMemoBytes(m.memo, contacts[partner], key.secretKey) : null;
    const part = bytes ? parseVoicePart(bytes) : null;
    if (part) voiceParts.push({ txId: m.txId, time: m.time, from: m.from, to: m.to, part });
    else textMemos.push({ ...m, text: bytes ? bytesToText(bytes) : null });
  }
  const assembled = assembleMessages(textMemos);
  const seen = new Set<string>();
  const texts: ConversationEntry[] = assembled.flatMap(m => {
    if (!m.text?.startsWith(PREFIX)) return [{ ...m, group: null as CryptGroup | null }];
    if (m.missing) return []; // partial metadata is never accepted as a group definition
    try {
      const raw = JSON.parse(m.text.slice(PREFIX.length));
      const group = parseGroup(raw);
      if (!group || typeof raw.text !== 'string' || !group.members.includes(key.account) || !group.members.includes(m.from) || !group.members.includes(m.to)) return [];
      // The sender sees a separate encrypted transfer copy per recipient.
      const id = `${m.txId}:${m.from}:${group.id}:${m.key}`;
      const fanoutId = m.parts > 1 ? id.replace(/:[^:]+$/, '') : `${m.txId}:${m.from}:${group.id}:${raw.text}`;
      if (seen.has(fanoutId)) return [];
      seen.add(fanoutId);
      return [{ ...m, key: fanoutId, text: raw.text as string, group }];
    } catch { return []; }
  });
  // Voice notes: one entry per note; a group note's per-recipient copies (seen by the sender) collapse into one.
  const voices = new Map<string, ConversationEntry>();
  for (const n of assembleVoice(voiceParts, now)) {
    let group: CryptGroup | null = null;
    if (n.isGroup) {
      group = n.group ? parseGroup(n.group) : null;
      // Without authenticated metadata a group note cannot be placed in a conversation.
      if (!group || !group.members.includes(key.account) || !group.members.includes(n.from) || !group.members.includes(n.to)) continue;
    }
    const k = group ? `voice:${n.from}:${group.id}:${n.id}` : `voice:${n.key}`;
    const prev = voices.get(k);
    if (prev?.voice && prev.voice.received >= n.received) continue;
    voices.set(k, { key: k, txId: n.txId, time: n.time, from: n.from, to: n.to, text: null, parts: n.total, missing: n.missing, group, voice: n });
  }
  return [...texts, ...voices.values()].sort((a, b) => a.time - b.time);
}

export function mergeGroups(existing: CryptGroup[], incoming: CryptGroup[]): CryptGroup[] {
  const groups = new Map(existing.map(g => [g.id, g]));
  incoming.forEach(g => { if (!groups.has(g.id)) groups.set(g.id, g); });
  return [...groups.values()];
}