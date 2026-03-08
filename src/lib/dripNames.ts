const STORAGE_KEY_PREFIX = "cheese_drip_names_";

function getKey(account: string): string {
  return `${STORAGE_KEY_PREFIX}${account}`;
}

export function getDripName(account: string, dripId: number): string {
  if (!account) return "";
  try {
    const data = localStorage.getItem(getKey(account));
    if (!data) return "";
    const names: Record<string, string> = JSON.parse(data);
    return names[String(dripId)] || "";
  } catch {
    return "";
  }
}

export function setDripName(account: string, dripId: number, name: string): void {
  if (!account) return;
  try {
    const key = getKey(account);
    const data = localStorage.getItem(key);
    const names: Record<string, string> = data ? JSON.parse(data) : {};
    if (name.trim()) {
      names[String(dripId)] = name.trim();
    } else {
      delete names[String(dripId)];
    }
    localStorage.setItem(key, JSON.stringify(names));
  } catch {
    // silently fail
  }
}

export function getAllDripNames(account: string): Record<number, string> {
  if (!account) return {};
  try {
    const data = localStorage.getItem(getKey(account));
    if (!data) return {};
    const raw: Record<string, string> = JSON.parse(data);
    const result: Record<number, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      result[Number(k)] = v;
    }
    return result;
  } catch {
    return {};
  }
}
