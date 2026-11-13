/** Terms are accepted once per browser per version, at wallet sign-in. Bump the version when the Terms change. */
export const TERMS_VERSION = "2026-08";
export const TERMS_STORAGE_KEY = "cheesehub_terms_accepted";

export function hasAcceptedTerms(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): boolean {
  try { return storage?.getItem(TERMS_STORAGE_KEY) === TERMS_VERSION; } catch { return false; }
}

export function acceptTerms(storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage): void {
  try { storage?.setItem(TERMS_STORAGE_KEY, TERMS_VERSION); } catch { /* private mode: accepted for this visit only */ }
}
