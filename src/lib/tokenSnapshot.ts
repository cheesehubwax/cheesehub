import { parseTokenSnapshot, type TokenSnapshot } from './tokenSnapshotSchema';
import { readStatCache, writeStatCache } from './statCache';
import { tokenPriceDataUrl } from './tokenPriceData';

const KEY = 'token-metadata-v1';
const METADATA_MAX_AGE = 365 * 86_400_000;
let pending: Promise<TokenSnapshot | null> | undefined;
let refreshedAt = 0;

export function readTokenSnapshot(): TokenSnapshot | null {
  return parseTokenSnapshot(readStatCache<unknown>(KEY, METADATA_MAX_AGE));
}

/** Bounded, shared refresh; cached metadata survives offline and blocked APIs. */
export function fetchTokenSnapshot(): Promise<TokenSnapshot | null> {
  if (pending) return pending;
  const saved = readTokenSnapshot();
  if (saved && Date.now() - refreshedAt < 3_600_000) return Promise.resolve(saved);
  pending = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${tokenPriceDataUrl()}/tokens.json?t=${Math.floor(Date.now() / 3_600_000)}`, { signal: controller.signal });
      if (!response.ok) return saved;
      const snapshot = parseTokenSnapshot(await response.json());
      if (!snapshot) return saved;
      writeStatCache(KEY, snapshot);
      refreshedAt = Date.now();
      return snapshot;
    } catch {
      return saved;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => { pending = undefined; });
  return pending;
}