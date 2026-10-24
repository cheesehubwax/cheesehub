import nacl from 'tweetnacl';
import type { ConversationEntry } from '@/lib/cryptGroups';
import { isProfileNote } from '@/lib/cryptProfileNotes';

export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const EDIT_LOG_MS = 72 * 60 * 60 * 1000;
export const EDIT_PREFIX = '\u0005E1:';
const TARGET = /^[a-f0-9]{64}$/;
export interface EditLogEntry { original: ConversationEntry; previous: ConversationEntry; replacement: EditedMessage; at: number }
export type EditedMessage = ConversationEntry & { editedAt?: number; editTxId?: string };

/** Ciphertext and fanout keys differ per recipient; authenticated content and transaction do not. */
export function editTarget(m: ConversationEntry): string {
  const content = m.voice ? Array.from(m.voice.audio ?? [], b => b.toString(16).padStart(2, '0')).join('') : m.text;
  return Array.from(nacl.hash(new Uint8Array(new TextEncoder().encode(JSON.stringify([m.txId, m.from, content])))).slice(0, 32), b => b.toString(16).padStart(2, '0')).join('');
}
export const canEdit = (m: ConversationEntry, account: string, now = Date.now()) => m.from === account && !m.missing && (!m.control || m.control.kind === 'msg') && (m.voice ? m.voice.status === 'ready' : m.text != null) && now >= m.time && now - m.time <= EDIT_WINDOW_MS;
export function encodeEdit(target: string, text: string): string {
  if (!TARGET.test(target) || !text.trim() || isProfileNote(text) || text.startsWith(EDIT_PREFIX)) throw new Error('Invalid message edit');
  return `${EDIT_PREFIX}${target}\n${text}`;
}
export function parseEdit(text: string | null): { target: string; text: string } | null {
  if (!text?.startsWith(EDIT_PREFIX)) return null;
  const target = text.slice(EDIT_PREFIX.length, EDIT_PREFIX.length + 64);
  const body = text.slice(EDIT_PREFIX.length + 65);
  return TARGET.test(target) && text[EDIT_PREFIX.length + 64] === '\n' && body.trim() && !isProfileNote(body) && !body.startsWith(EDIT_PREFIX) ? { target, text: body } : null;
}
const scope = (m: ConversationEntry) => m.igroup ? `i:${m.igroup}` : m.group ? `g:${m.group.id}:${m.group.members.join(',')}` : `d:${[m.from, m.to].sort().join(',')}`;

/** Invalid, partial, late and forged edits never become chat rows or overwrite originals. */
export function applyEdits(entries: ConversationEntry[]): { messages: EditedMessage[]; log: EditLogEntry[] } {
  const originals = entries.filter(m => !m.text?.startsWith(EDIT_PREFIX) && !m.voice?.editTarget);
  const messages: EditedMessage[] = originals.map(m => ({ ...m }));
  const index = new Map<string, number>();
  const ambiguous = new Set<string>();
  originals.forEach((m, i) => {
    const ref = `${scope(m)}:${m.from}:${editTarget(m)}`;
    if (index.has(ref)) ambiguous.add(ref);
    else index.set(ref, i);
  });
  const log: EditLogEntry[] = [];
  const edits = entries.filter(m => m.text?.startsWith(EDIT_PREFIX) || m.voice?.editTarget).sort((a, b) => (a.voice?.completedAt ?? a.time) - (b.voice?.completedAt ?? b.time) || a.txId.localeCompare(b.txId));
  const seen = new Set<string>();
  for (const edit of edits) {
    const parsed = parseEdit(edit.text);
    const target = edit.voice?.editTarget ?? parsed?.target;
    if (!target || edit.missing || (edit.voice && edit.voice.status !== 'ready')) continue;
    const ref = `${scope(edit)}:${edit.from}:${target}`;
    if (ambiguous.has(ref)) continue;
    const i = index.get(ref);
    if (i === undefined) continue;
    const original = originals[i], at = edit.voice?.completedAt ?? edit.time;
    if (!canEdit(original, edit.from, at)) continue;
    const unique = `${scope(edit)}:${edit.from}:${target}:${edit.txId}`;
    if (seen.has(unique)) continue;
    seen.add(unique);
    const previous = messages[i];
    const replacement = { ...original, text: parsed?.text ?? null, voice: edit.voice, editedAt: at, editTxId: edit.txId };
    messages[i] = replacement;
    log.push({ original, previous, replacement, at });
  }
  return { messages, log };
}
export function publicEditLog(log: EditLogEntry[], room: string, creator: string, account: string, listed: boolean, now = Date.now()) {
  if (!listed || creator !== account) return [];
  return log.filter(e => e.original.igroup === room && e.at <= now && now - e.at <= EDIT_LOG_MS).sort((a, b) => b.at - a.at);
}