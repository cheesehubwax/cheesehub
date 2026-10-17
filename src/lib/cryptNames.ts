/** Names are presentation-only; WAX account IDs remain the identity. */
export const MAX_CRYPT_NAME_LENGTH = 40;
export function parseCryptName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const name = value.trim();
  return name && [...name].length <= MAX_CRYPT_NAME_LENGTH && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name) ? name : undefined;
}
type NameKind = 'names' | 'nicknames';
const store = (account: string, kind: NameKind) => `cheesecrypt-${kind}-${account}`;
export function loadCryptNames(account: string, kind: NameKind = 'names'): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(store(account, kind)) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const entries = Object.entries(raw).flatMap(([id, value]) => {
      const name = parseCryptName(value);
      return name ? [[id, name]] : [];
    });
    return Object.fromEntries(entries);
  } catch { return {}; }
}
export function saveCryptName(account: string, contact: string, value: unknown, kind: NameKind = 'names') {
  const names = loadCryptNames(account, kind);
  const name = parseCryptName(value);
  if (name) names[contact] = name;
  else delete names[contact];
  localStorage.setItem(store(account, kind), JSON.stringify(names));
}
export function cryptDisplayName(account: string, names: Record<string, string>, nicknames: Record<string, string>): string {
  return parseCryptName(nicknames[account]) ?? parseCryptName(names[account]) ?? account;
}