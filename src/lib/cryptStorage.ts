/** Fail-safe device storage. Failed writes stay in this tab, never in another store. */
export type CryptStorageIssue = 'quota' | 'unavailable' | null;
const pending = new Map<string, string | null>();
const listeners = new Set<() => void>();
let issue: CryptStorageIssue = null;

export function isStorageQuotaError(error: unknown): boolean {
  try {
    return !!error && typeof error === 'object' && 'name' in error
      && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
  } catch { return false; }
}
function report(error: unknown) {
  const next = isStorageQuotaError(error) ? 'quota' : 'unavailable';
  if (issue === next || issue === 'quota') return;
  issue = next;
  // Storage is also read/written during render; notify after that render completes.
  queueMicrotask(() => listeners.forEach(listener => listener()));
}
export const subscribeCryptStorage = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getCryptStorageIssue = () => issue;

/** Only reconstructible lookup caches: never keys, contacts, consent, receipts or controls. */
export const CRYPT_DISPOSABLE_CACHE_KEYS = ['cheesecrypt-trust-snapshot-v1'] as const;

export const cryptStorage = {
  getItem(key: string): string | null {
    if (pending.has(key)) return pending.get(key) ?? null;
    try { return localStorage.getItem(key); } catch (error) { report(error); return null; }
  },
  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); pending.delete(key); }
    catch (error) { pending.set(key, value); report(error); }
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key); pending.delete(key); }
    catch (error) { pending.set(key, null); report(error); }
  },
};

/** Reclaim only disposable caches, then retry session-local changes without reloading. */
export function clearCryptLookupCache(): boolean {
  for (const key of CRYPT_DISPOSABLE_CACHE_KEYS) {
    pending.delete(key);
    try { localStorage.removeItem(key); } catch (error) { report(error); return false; }
  }
  for (const [key, value] of pending) {
    try {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
      pending.delete(key);
    } catch (error) { report(error); return false; }
  }
  issue = null;
  listeners.forEach(listener => listener());
  return true;
}