// Browser-only storage for CHEESEFolio (IndexedDB). Nothing is uploaded.
import type { RawTransfer } from './types';

const DB_NAME = 'cheesefolio';
const DB_VERSION = 1;
const STORE = 'accounts';

/** Bump when the stored shape changes; older records are discarded and rescanned. */
export const FOLIO_SCHEMA = 2;

export interface ProviderCursor {
  /** Last block time read from this provider, ISO string. */
  after: string | null;
  /** True once this provider has been read up to the present at least once. */
  caughtUp: boolean;
  /** Page size this provider accepts, learned from its "limit too big" reply. */
  limit?: number;
  /** Date windows still being read during the first full read of this provider. */
  windows?: ScanWindow[];
}

export interface ScanWindow {
  after: string | null;
  before: string | null;
  done: boolean;
}

export interface StoredFolio {
  account: string;
  schema: number;
  transfers: RawTransfer[];
  cursors: Record<string, ProviderCursor>;
  /** Epoch ms of the last completed sync. */
  syncedAt: number | null;
  /** Oldest transfer any chosen provider holds (epoch ms). */
  coverageFrom?: number;
  /** Account creation time from the chain (epoch ms). */
  accountCreated?: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('This browser has no local storage for CHEESEFolio'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'account' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => { db.close(); resolve(req.result as T); };
        tx.onerror = () => { db.close(); reject(tx.error); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      }),
  );
}

export async function loadFolio(account: string): Promise<StoredFolio | null> {
  const rec = await run<StoredFolio | undefined>('readonly', (s) => s.get(account));
  if (!rec || rec.schema !== FOLIO_SCHEMA) return null;
  return rec;
}

export function saveFolio(rec: StoredFolio): Promise<unknown> {
  return run('readwrite', (s) => s.put(rec));
}

export function clearFolio(account: string): Promise<unknown> {
  return run('readwrite', (s) => s.delete(account));
}
