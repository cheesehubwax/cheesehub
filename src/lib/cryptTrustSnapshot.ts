/**
 * 24-hour on-device copy of confirmed Respect lookups, so badges for known
 * accounts load with no network request after a reload. Only successful
 * (non-null) values are stored; failures stay in memory with a short cooldown.
 */
import { cryptStorage } from '@/lib/cryptStorage';
const STORAGE_KEY = 'cheesecrypt-trust-snapshot-v1';
export const SNAPSHOT_TTL_MS = 86_400_000;
const MAX_ENTRIES = 2_000;
/** Conservative UTF-16 size; leave device room for keys, controls and local decisions. */
export const SNAPSHOT_MAX_BYTES = 256 * 1024;
type Entry = { at: number; value: unknown };
type Store = Record<string, Entry>;

function bounded(store: Store, now: number): Store {
  const out: Store = Object.create(null);
  let bytes = 4; // JSON braces in UTF-16
  let count = 0;
  for (const [key, entry] of Object.entries(store).sort((a, b) => b[1].at - a[1].at)) {
    if (entry.at > now || now >= entry.at + SNAPSHOT_TTL_MS || count >= MAX_ENTRIES) continue;
    const size = 2 * (JSON.stringify(key).length + 1 + JSON.stringify(entry).length + (bytes > 4 ? 1 : 0));
    if (bytes + size > SNAPSHOT_MAX_BYTES) continue;
    out[key] = entry;
    bytes += size;
    count++;
  }
  return out;
}

function load(now = Date.now()): Store {
  try {
    const stored = cryptStorage.getItem(STORAGE_KEY);
    const raw = JSON.parse(stored || 'null');
    if (!raw || typeof raw !== 'object') return {};
    const out: Store = Object.create(null);
    for (const [k, e] of Object.entries(raw as Record<string, Entry>)) {
      if (e && typeof e.at === 'number' && Number.isFinite(e.at) && e.value != null) out[k] = e;
    }
    const trimmed = bounded(out, now);
    // Shrink oversized legacy caches as soon as they are read, not only on a fresh lookup.
    if (Object.keys(trimmed).length !== Object.keys(raw).length || 2 * (stored?.length ?? 0) > SNAPSHOT_MAX_BYTES) {
      cryptStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }
    return trimmed;
  } catch { return {}; }
}

/** A stored value with its remaining lifetime, or null when absent/expired. */
export function getSnapshot(key: string, now = Date.now()): { value: unknown; expiresAt: number } | null {
  const e = load(now)[key];
  if (!e) return null;
  const expiresAt = e.at + SNAPSHOT_TTL_MS;
  // A timestamp in the future (clock change) is not trusted.
  if (e.at > now || now >= expiresAt) return null;
  return { value: e.value, expiresAt };
}

export function setSnapshot(key: string, value: unknown, now = Date.now()) {
  if (value == null) return;
  try {
    const s = load(now);
    for (const [k, e] of Object.entries(s)) if (now >= e.at + SNAPSHOT_TTL_MS || e.at > now) delete s[k];
    s[key] = { at: now, value };
    cryptStorage.setItem(STORAGE_KEY, JSON.stringify(bounded(s, now)));
  } catch { /* storage unavailable: memory cache only */ }
}

/** Accounts with an unexpired stored lookup (used as realistic decoys). */
export function snapshotAccounts(now = Date.now()): string[] {
  const out = new Set<string>();
  for (const [k, e] of Object.entries(load(now))) {
    if (now < e.at + SNAPSHOT_TTL_MS && e.at <= now) out.add(k.slice(k.indexOf(':') + 1));
  }
  return [...out];
}
