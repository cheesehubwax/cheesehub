// Draw-then-refresh cache for headline numbers.
//
// A chain read can take seconds (or fail on a host that is unreachable from a
// given browser). Rather than show empty boxes while that plays out, the last
// good answer is kept in localStorage and painted immediately, then replaced as
// soon as a fresh read lands. Values are versioned so a shape change can never
// hydrate an old payload into new code.

const PREFIX = 'cheesehub:stat:';
const VERSION = 1;
/** Beyond this age a cached value is discarded rather than shown. */
export const STAT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface Envelope<T> {
  v: number;
  at: number;
  data: T;
}

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Private-mode browsers throw on access; caching is a nicety, never required.
    return null;
  }
};

/** Last good value for `key`, or undefined when absent, stale or unreadable. */
export function readStatCache<T>(key: string, maxAgeMs = STAT_CACHE_MAX_AGE_MS): T | undefined {
  const store = storage();
  if (!store) return undefined;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (parsed.v !== VERSION) return undefined;
    if (!Number.isFinite(parsed.at) || Date.now() - parsed.at > maxAgeMs) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

/** Store a fresh value for `key`. Failures are silent by design. */
export function writeStatCache<T>(key: string, data: T): void {
  const store = storage();
  if (!store) return;
  try {
    const envelope: Envelope<T> = { v: VERSION, at: Date.now(), data };
    store.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Quota or private mode — nothing to do.
  }
}

/** Wraps a query function so every successful answer updates the cache. */
export function cached<T>(key: string, fn: () => Promise<T>): () => Promise<T> {
  return async () => {
    const data = await fn();
    writeStatCache(key, data);
    return data;
  };
}

export function clearStatCache(key: string): void {
  storage()?.removeItem(PREFIX + key);
}
