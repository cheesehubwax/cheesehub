import { cryptStorage } from '@/lib/cryptStorage';
/**
 * Respect signals that can never change once known: account creation time and
 * the earliest published CHEESECrypt key time. Stored on this device so they are
 * read from the network only once per account.
 */
const STORAGE_KEY = 'cheesecrypt-trust-permanent-v1';
type Kind = 'created' | 'firstKey';
type Store = Record<Kind, Record<string, number>>;

const empty = (): Store => ({ created: {}, firstKey: {} });
const valid = (t: unknown): t is number => typeof t === 'number' && Number.isFinite(t) && t > 0;

function load(): Store {
  try {
    const raw = JSON.parse(cryptStorage.getItem(STORAGE_KEY) || 'null');
    const out = empty();
    for (const kind of ['created', 'firstKey'] as Kind[]) {
      const m = raw?.[kind];
      if (m && typeof m === 'object') for (const [a, t] of Object.entries(m)) if (valid(t)) out[kind][a] = t;
    }
    return out;
  } catch { return empty(); }
}

export function getPermanent(kind: Kind, account: string): number | null {
  const t = load()[kind][account];
  return valid(t) ? t : null;
}

/** Only confirmed values are stored; failures and unknowns are never persisted. */
export function setPermanent(kind: Kind, account: string, t: number | null | undefined) {
  if (!account || !valid(t)) return;
  try {
    const s = load();
    // The earliest key time can only move earlier, never later.
    if (kind === 'firstKey' && valid(s.firstKey[account]) && s.firstKey[account] <= t) return;
    s[kind][account] = t;
    cryptStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* storage unavailable: fall back to network reads */ }
}
