// Session-persistent record of token-logo URLs that returned 404, so we can
// skip re-issuing the <img> request on subsequent renders and stop flooding
// the console with 404s for tokens Alcor has no logo file for.

const STORAGE_KEY = "cheesehub:token-logo-misses";

let missing: Set<string> | null = null;

function key(contract: string, ticker: string): string {
  return `${contract}:${ticker}`.toLowerCase();
}

function load(): Set<string> {
  if (missing) return missing;
  missing = new Set<string>();
  if (typeof window === "undefined") return missing;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const k of arr) if (typeof k === "string") missing.add(k);
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return missing;
}

function persist() {
  if (typeof window === "undefined" || !missing) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...missing]));
  } catch {
    // storage full / disabled — silently drop
  }
}

export function hasMissingLogo(contract: string, ticker: string): boolean {
  if (!contract || !ticker) return false;
  return load().has(key(contract, ticker));
}

export function markMissingLogo(contract: string, ticker: string): void {
  if (!contract || !ticker) return;
  const set = load();
  const k = key(contract, ticker);
  if (set.has(k)) return;
  set.add(k);
  persist();
}