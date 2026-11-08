// CHEESECrypt network privacy settings: device-local only, never sent anywhere.
// No CHEESEHub-run relay exists; a custom server only points this browser at a server the user chose.
import { normalizeEndpoint, resolveEndpoints } from '@/lib/endpointHealth';

export type PrivacyMode = 'standard' | 'maximum';
const MODE_KEY = 'cheesecrypt-privacy-mode';
const NODE_KEY = 'cheesecrypt-custom-hyperion';
const ONLY_KEY = 'cheesecrypt-custom-hyperion-only';

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ }
};

export const loadPrivacyMode = (): PrivacyMode => (read(MODE_KEY) === 'maximum' ? 'maximum' : 'standard');
export const savePrivacyMode = (m: PrivacyMode) => write(MODE_KEY, m);

/** https anywhere, or http only to this computer (own node / local tunnel). No credentials, query or fragment. */
export function validateCustomEndpoint(input: string): string | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return null;
  if (u.username || u.password || u.search || u.hash) return null;
  return normalizeEndpoint(`${u.origin}${u.pathname}`.replace(/\/+$/, ''));
}

export const loadCustomEndpoint = (): string | null => { const v = read(NODE_KEY); return v ? validateCustomEndpoint(v) : null; };
export const loadCustomOnly = (): boolean => read(ONLY_KEY) === '1' && !!loadCustomEndpoint();
export function saveCustomEndpoint(url: string | null, only: boolean) {
  write(NODE_KEY, url);
  write(ONLY_KEY, url && only ? '1' : null);
}

/** Pure ordering: custom server first; with `only`, nothing else. */
export function orderWithCustom(list: string[], custom: string | null, only: boolean): string[] {
  if (!custom) return list;
  if (only) return [custom];
  return [custom, ...list.filter(u => normalizeEndpoint(u) !== custom)];
}

/** History servers for CHEESECrypt reads. */
export async function cryptHistoryEndpoints(): Promise<string[]> {
  const custom = loadCustomEndpoint(), only = loadCustomOnly();
  if (custom && only) return [custom];
  return orderWithCustom(await resolveEndpoints('hyperion-v2'), custom, false);
}

/** Custom Tor reads can try four bounded 8s upstreams; include body parsing. */
export const historyTimeoutMs = (url: string): number => url === loadCustomEndpoint() || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/.test(url) ? 40000 : 10000;

export async function fetchCryptHistoryJson(url: string, path: string): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), historyTimeoutMs(url));
  try {
    const r = await fetch(`${url}${path}`, { signal: ctl.signal });
    const j = await r.json();
    if (!r.ok) throw new Error(typeof j?.error === 'string' ? j.error.slice(0, 300) : `Server returned HTTP ${r.status}.`);
    return j;
  } finally { clearTimeout(t); }
}

export async function checkHistoryEndpoint(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const j = await fetchCryptHistoryJson(url, '/v2/history/get_actions?account=crypt.cheese&limit=1');
    return Array.isArray(j?.actions) ? { ok: true } : { ok: false, error: 'The server answered, but did not return WAX history actions. Nothing was saved.' };
  } catch (e) {
    const local = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/.test(url);
    const error = e instanceof Error && e.name === 'AbortError'
      ? 'The connection timed out. Keep Tor Browser connected and the updated helper running, then try again.'
      : e instanceof TypeError && local
        ? 'Cannot reach the local helper. Keep its terminal open, check http://127.0.0.1:8088, and allow local-network access if your browser asks.'
        : e instanceof Error ? e.message : 'Connection failed.';
    return { ok: false, error: `${error} Nothing was saved.` };
  }
}

/** Compatibility for callers expecting a boolean. */
export async function testHistoryEndpoint(url: string): Promise<boolean> {
  return (await checkHistoryEndpoint(url)).ok;
}
