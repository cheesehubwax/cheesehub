/** Per-account read markers: conversation id ("group:<id>" or a WAX account) -> newest read message time. */
export type ReadMarks = Record<string, number>;
interface Msg { from: string; to: string; time: number; group: { id: string } | null; igroup?: string }

const storeKey = (account: string) => `cheesecrypt-read-${account}`;
export const conversationId = (m: Msg, account: string) => m.group ? `group:${m.group.id}` : m.igroup ? `group:${m.igroup}` : (m.from === account ? m.to : m.from);

/** Null when this account has never stored read markers on this device. */
export function loadReadMarks(account: string): ReadMarks | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storeKey(account)) || 'null');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const out: ReadMarks = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    return out;
  } catch { return null; }
}
export const saveReadMarks = (account: string, marks: ReadMarks) => localStorage.setItem(storeKey(account), JSON.stringify(marks));

/** Marks every existing conversation read at its newest message (first visit: no phantom badges on old history). */
export function baselineMarks(messages: Msg[], account: string): ReadMarks {
  const out: ReadMarks = {};
  for (const m of messages) { const id = conversationId(m, account); out[id] = Math.max(out[id] ?? 0, m.time); }
  return out;
}

/** Incoming messages newer than the read marker, per conversation. Own messages never count. */
export function unreadCounts(messages: Msg[], account: string, marks: ReadMarks): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) {
    if (m.from === account) continue;
    const id = conversationId(m, account);
    if (m.time > (marks[id] ?? 0)) out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

// ---- read markers shared with the vault folder (device-only; no message content or keys) ----
const MARK_ID = /^(group:[a-f0-9]{16}|[a-z1-5.]{1,12})$/;
export const READ_STATE_TYPE = 'cheesecrypt-read-state';

export function normalizeMarks(value: unknown): ReadMarks {
  const out: ReadMarks = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [id, t] of Object.entries(value)) if (MARK_ID.test(id) && typeof t === 'number' && Number.isSafeInteger(t) && t >= 0) out[id] = t;
  return out;
}

/** Newest read time wins per conversation, so neither copy ever turns a read chat unread again. */
export function mergeMarks(a: ReadMarks, b: ReadMarks): ReadMarks {
  const out = { ...a };
  for (const [id, t] of Object.entries(b)) out[id] = Math.max(out[id] ?? 0, t);
  return out;
}

export const sameMarks = (a: ReadMarks, b: ReadMarks) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

export const toReadStateFile = (account: string, marks: ReadMarks) => ({ type: READ_STATE_TYPE, version: 1, account, reads: normalizeMarks(marks) });

/** Null unless the file is a v1 read-state file for exactly this account. */
export function parseReadStateFile(value: unknown, account: string): ReadMarks | null {
  const f = value as Record<string, unknown> | null;
  if (!f || typeof f !== 'object' || f.type !== READ_STATE_TYPE || f.version !== 1 || f.account !== account) return null;
  return normalizeMarks(f.reads);
}

/** First visit on this device: folder markers win for chats they cover; other existing chats start read. */
export const firstVisitMarks = (baseline: ReadMarks, folder: ReadMarks | null): ReadMarks => folder ? { ...baseline, ...folder } : baseline;
