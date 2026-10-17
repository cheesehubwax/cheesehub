/** Per-account read markers: conversation id ("group:<id>" or a WAX account) -> newest read message time. */
export type ReadMarks = Record<string, number>;
interface Msg { from: string; to: string; time: number; group: { id: string } | null }

const storeKey = (account: string) => `cheesecrypt-read-${account}`;
export const conversationId = (m: Msg, account: string) => m.group ? `group:${m.group.id}` : (m.from === account ? m.to : m.from);

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
