import { assembleMessages, bytesToText, decryptMemoBytes, type ChainMemo, type MessagingKey } from '@/lib/cheeseCrypt';

export const MAX_INBOX_KEY_LOOKUPS = 20;
const ACCOUNT = /^[a-z1-5.]{1,12}$/;
const setting = (account: string) => `cheesecrypt-public-inbox-${account}`;
const gone = (account: string) => `cheesecrypt-request-declines-${account}`;
export const loadPublicInbox = (account: string): boolean => localStorage.getItem(setting(account)) === 'true';
export const savePublicInbox = (account: string, enabled: boolean) => localStorage.setItem(setting(account), String(enabled));
export function loadRequestDeclines(account: string): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(gone(account)) || '{}');
    return Object.fromEntries(Object.entries(raw || {}).filter(([a, t]) => ACCOUNT.test(a) && typeof t === 'number' && Number.isFinite(t) && t >= 0)) as Record<string, number>;
  } catch { return {}; }
}
export function declineRequest(account: string, from: string, time: number) {
  const next = { ...loadRequestDeclines(account), [from]: Math.max(loadRequestDeclines(account)[from] ?? 0, time) };
  localStorage.setItem(gone(account), JSON.stringify(next));
  return next;
}

/** Newest incoming senders only. Known/group/blocked/removed identities never enter stranger discovery. */
export function inboxCandidates(memos: ChainMemo[], account: string, excluded: Set<string>): string[] {
  const newest = new Map<string, number>();
  for (const m of memos) {
    if (m.to !== account || m.from === account || !ACCOUNT.test(m.from) || excluded.has(m.from)) continue;
    newest.set(m.from, Math.max(newest.get(m.from) ?? 0, m.time));
  }
  return [...newest].sort((a, b) => b[1] - a[1]).slice(0, MAX_INBOX_KEY_LOOKUPS).map(([a]) => a);
}

export interface InboxRequest {
  from: string;
  publicKey: string;
  time: number;
  messages: ReturnType<typeof assembleMessages>;
}
/** Separate decoding path: no group definitions, profile updates, voice assembly or contact writes. */
export function decodeInboxRequests(memos: ChainMemo[], key: MessagingKey, published: Record<string, string>, declines: Record<string, number>): InboxRequest[] {
  const decoded = [];
  for (const m of memos) {
    const pub = published[m.from];
    if (!pub || m.to !== key.account || m.from === key.account) continue;
    const bytes = decryptMemoBytes(m.memo, pub, key.secretKey);
    // Voice is byte-headed 0x03 and is never assembled or played in requests.
    if (!bytes || bytes[0] === 3) continue;
    const text = bytesToText(bytes);
    if (text !== null) decoded.push({ ...m, text });
  }
  const byFrom = new Map<string, InboxRequest>();
  for (const m of assembleMessages(decoded)) {
    // Control envelopes start with a non-text marker (including CG1/CG2 and CP1).
    if (m.missing || !m.text?.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(m.text) || m.time <= (declines[m.from] ?? 0)) continue;
    const r = byFrom.get(m.from) ?? { from: m.from, publicKey: published[m.from], time: 0, messages: [] };
    r.messages.push(m); r.time = Math.max(r.time, m.time); byFrom.set(m.from, r);
  }
  return [...byFrom.values()].sort((a, b) => b.time - a.time);
}