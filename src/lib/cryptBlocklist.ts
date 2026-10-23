// CHEESECrypt local block list: accounts whose messages are never decrypted or shown on this device.
// Stored per WAX account in this browser only; nothing changes on-chain.
const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
const storeKey = (account: string) => `cheesecrypt-blocked-${account}`;

export function normalizeAccount(a: string): string | null {
  const n = a.trim().toLowerCase();
  return ACCOUNT_RE.test(n) ? n : null;
}

const clean = (list: readonly string[]) =>
  [...new Set(list.map(normalizeAccount).filter((x): x is string => !!x))].sort();

export function addBlocked(list: readonly string[], acct: string, self?: string): string[] {
  const n = normalizeAccount(acct);
  if (!n) throw new Error('Not a valid WAX account name');
  if (self && n === self) throw new Error("You can't block your own account");
  return clean([...list, n]);
}

export const removeBlocked = (list: readonly string[], acct: string) => clean(list.filter(a => a !== normalizeAccount(acct)));

export function loadBlocked(account: string): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storeKey(account)) || '[]');
    return Array.isArray(raw) ? clean(raw.filter((x): x is string => typeof x === 'string')).filter(a => a !== account) : [];
  } catch { return []; }
}

export const saveBlocked = (account: string, list: readonly string[]) =>
  localStorage.setItem(storeKey(account), JSON.stringify(clean(list)));

/** Drops every memo exchanged with a blocked account before anything is decrypted (DMs, group copies, voice parts). */
export function withoutBlocked<T extends { from: string; to: string }>(memos: readonly T[], account: string, blocked: readonly string[]): T[] {
  if (!blocked.length) return [...memos];
  const set = new Set(blocked);
  return memos.filter(m => !set.has(m.from === account ? m.to : m.from));
}
