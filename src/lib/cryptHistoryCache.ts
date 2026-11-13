/** Device-local public ciphertext only. Never persist keys or decoded conversations. */
import { msgPrefixOf, mergeMemos, type ChainMemo } from './cheeseCrypt';
import { FINAL_AGE_MS } from './cryptRouterCache';
import type { PrivacyMode } from './cryptNetworkPrivacy';

export interface HistorySnapshot { version: 1; account: string; mode: PrivacyMode; rows: ChainMemo[]; cursor: number; depth: number }
const DB = 'cheesecrypt-history';
const STORE = 'accounts';
let opening: Promise<IDBDatabase | null> | undefined;
function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise(resolve => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return opening;
}

export function validateHistory(value: unknown, account: string, mode: PrivacyMode): HistorySnapshot | null {
  const s = value as Partial<HistorySnapshot> | null;
  if (!s || s.version !== 1 || s.account !== account || s.mode !== mode || !Array.isArray(s.rows) ||
      !Number.isFinite(s.cursor) || typeof s.cursor !== 'number' || s.cursor <= 0 || s.cursor > Date.now() ||
      !Number.isInteger(s.depth) || typeof s.depth !== 'number' || s.depth < 1 || s.depth > 4) return null;
  const rows: ChainMemo[] = [];
  for (const r of s.rows) {
    if (!r || typeof r.txId !== 'string' || typeof r.from !== 'string' || typeof r.to !== 'string' ||
        typeof r.memo !== 'string' || typeof r.quantity !== 'string' || !Number.isFinite(r.time) ||
        !msgPrefixOf(r.memo) || (r.from !== account && r.to !== account) || r.from === 'crypt.cheese' || r.to === 'crypt.cheese') return null;
    // Whitelist fields: no extra decrypted content can survive storage or hydration.
    rows.push({ txId: r.txId, time: r.time, from: r.from, to: r.to, memo: r.memo, quantity: r.quantity });
  }
  return { version: 1, account, mode, rows: mergeMemos([], rows), cursor: s.cursor, depth: s.depth };
}

export async function loadHistory(account: string, mode: PrivacyMode): Promise<HistorySnapshot | null> {
  const db = await open();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(`${account}:${mode}`);
      req.onsuccess = () => resolve(validateHistory(req.result, account, mode));
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

/** Rows and complete-only checkpoint commit together; recent reversible rows are re-read after restart. */
export async function saveHistory(account: string, mode: PrivacyMode, rows: ChainMemo[], cursor: number, depth: number): Promise<void> {
  const finalBefore = Date.now() - FINAL_AGE_MS;
  const snapshot = validateHistory({ version: 1, account, mode, rows: rows.filter(r => r.time <= finalBefore), cursor: Math.min(cursor, finalBefore), depth }, account, mode);
  const db = await open();
  if (!db || !snapshot) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(snapshot, `${account}:${mode}`);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => resolve();
    } catch { resolve(); }
  });
}