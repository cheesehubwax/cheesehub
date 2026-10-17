import nacl from 'tweetnacl';
import {
  assembleMessages, buildSendMessageActions, ChainMemo, decryptMemo, encryptMemo,
  MAX_MESSAGE_BYTES, MessagingKey, partCount, plaintextBytes, splitMessage,
} from '@/lib/cheeseCrypt';

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

export function groupPayload(group: CryptGroup, text: string): string {
  const valid = parseGroup(group);
  if (!valid) throw new Error('Invalid group.');
  return PREFIX + JSON.stringify({ ...valid, text });
}
export function groupMessageSize(group: CryptGroup, text: string) {
  const payload = groupPayload(group, text);
  return { parts: partCount(payload), maxBytes: MAX_MESSAGE_BYTES - plaintextBytes(groupPayload(group, '')), bytes: plaintextBytes(text) };
}

export function buildGroupMessageActions(key: MessagingKey, group: CryptGroup, text: string, contacts: Record<string, string>, auth: unknown[]) {
  if (!text.trim()) throw new Error('Message is empty');
  const valid = parseGroup(group);
  if (!valid || !valid.members.includes(key.account)) throw new Error('You are not a member of this group.');
  const recipients = valid.members.filter(m => m !== key.account);
  if (recipients.some(m => !contacts[m])) throw new Error('Load every group member’s public key before sending.');
  const parts = splitMessage(groupPayload(valid, text));
  return recipients.flatMap(to => buildSendMessageActions(key.account, to,
    parts.map(p => encryptMemo(p, contacts[to], key.secretKey)), auth));
}

/** Only authenticated, fully reassembled envelopes can define a group. */
export function decodeConversations(memos: ChainMemo[], key: MessagingKey, contacts: Record<string, string>) {
  const assembled = assembleMessages(memos.filter(m => m.from === key.account || m.to === key.account).map(m => {
    const partner = m.from === key.account ? m.to : m.from;
    return { ...m, text: contacts[partner] ? decryptMemo(m.memo, contacts[partner], key.secretKey) : null };
  }));
  const seen = new Set<string>();
  return assembled.flatMap(m => {
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
}

export function mergeGroups(existing: CryptGroup[], incoming: CryptGroup[]): CryptGroup[] {
  const groups = new Map(existing.map(g => [g.id, g]));
  incoming.forEach(g => { if (!groups.has(g.id)) groups.set(g.id, g); });
  return [...groups.values()];
}