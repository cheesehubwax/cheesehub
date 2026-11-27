/**
 * 24-hour on-device copy of confirmed Respect lookups, so badges for known
 * accounts load with no network request after a reload. Only successful
 * (non-null) values are stored; failures stay in memory with a short cooldown.
 */
const STORAGE_KEY = 'cheesecrypt-trust-snapshot-v1';
export const SNAPSHOT_TTL_MS = 86_400_000;
const MAX_ENTRIES = 2_000;
type Entry = { at: number; value: unknown };
type Store = Record<string, Entry>;

function load(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return {};
    const out: Store = {};
    for (const [k, e] of Object.entries(raw as Record<string, Entry>)) {
      if (e && typeof e.at === 'number' && Number.isFinite(e.at) && e.value != null) out[k] = e;
    }
    return out;
  } catch { return {}; }
}

/** A stored value with its remaining lifetime, or null when absent/expired. */
export function getSnapshot(key: string, now = Date.now()): { value: unknown; expiresAt: number } | null {
  const e = load()[key];
  if (!e) return null;
  const expiresAt = e.at + SNAPSHOT_TTL_MS;
  // A timestamp in the future (clock change) is not trusted.
  if (e.at > now || now >= expiresAt) return null;
  return { value: e.value, expiresAt };
}

export function setSnapshot(key: string, value: unknown, now = Date.now()) {
  if (value == null) return;
  try {
    const s = load();
    for (const [k, e] of Object.entries(s)) if (now >= e.at + SNAPSHOT_TTL_MS || e.at > now) delete s[k];
    s[key] = { at: now, value };
    const keys = Object.keys(s);
    if (keys.length > MAX_ENTRIES) {
      keys.sort((a, b) => s[a].at - s[b].at).slice(0, keys.length - MAX_ENTRIES).forEach(k => delete s[k]);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* storage unavailable: memory cache only */ }
}

/** Accounts with an unexpired stored lookup (used as realistic decoys). */
export function snapshotAccounts(now = Date.now()): string[] {
  const out = new Set<string>();
  for (const [k, e] of Object.entries(load())) {
    if (now < e.at + SNAPSHOT_TTL_MS && e.at <= now) out.add(k.slice(k.indexOf(':') + 1));
  }
  return [...out];
}
