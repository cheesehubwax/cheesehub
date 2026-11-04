/**
 * Persistent (IndexedDB) cache of authenticated router transaction expansions, keyed by transaction ID.
 * A transaction's actions never change once it is irreversible, so only transactions older than
 * FINAL_AGE_MS are stored. Stored rows hold the same public on-chain ciphertext Hyperion returns.
 */
export interface CachedRow { txId: string; time: number; from: string; to: string; memo: string; quantity: string }

const DB = 'cheesecrypt-router-cache';
const STORE = 'tx';
const MAX_ENTRIES = 20000;
export const FINAL_AGE_MS = 5 * 60 * 1000;

let dbPromise: Promise<IDBDatabase | null> | null = null;
function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

let loaded: Promise<Map<string, CachedRow[]>> | null = null;
/** Loads every stored entry once per page load. Failures fall back to an empty cache. */
export function loadRouterCache(): Promise<Map<string, CachedRow[]>> {
  if (loaded) return loaded;
  loaded = (async () => {
    const out = new Map<string, CachedRow[]>();
    const db = await open();
    if (!db) return out;
    await new Promise<void>(resolve => {
      try {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (!c) return resolve();
          const v = c.value as { rows?: unknown };
          if (Array.isArray(v?.rows)) out.set(String(c.key), v.rows as CachedRow[]);
          c.continue();
        };
        req.onerror = () => resolve();
      } catch { resolve(); }
    });
    return out;
  })();
  return loaded;
}

/** Stores a final transaction's expansion; recent (possibly reversible) ones are kept in memory only. */
export async function saveRouterTx(txId: string, time: number, rows: CachedRow[]): Promise<void> {
  if (!Number.isFinite(time) || Date.now() - time < FINAL_AGE_MS) return;
  const map = await loadRouterCache();
  map.set(txId, rows);
  const db = await open();
  if (!db) return;
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    store.put({ rows, time }, txId);
    if (map.size > MAX_ENTRIES) {
      // Drop the oldest quarter by transaction time.
      const old = [...map.entries()].sort((a, b) => (a[1][0]?.time ?? 0) - (b[1][0]?.time ?? 0)).slice(0, MAX_ENTRIES / 4);
      for (const [id] of old) { map.delete(id); store.delete(id); }
    }
  } catch { /* cache is best-effort */ }
}
