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
/** Remember the checkbox independently; routing activates it only with a saved server. */
export const loadCustomOnlyPreference = (): boolean => read(ONLY_KEY) === '1';
export const saveCustomOnlyPreference = (only: boolean) => write(ONLY_KEY, only ? '1' : null);
export const loadCustomOnly = (): boolean => loadCustomOnlyPreference() && !!loadCustomEndpoint();

const isLoopback = (url: string): boolean => /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/.test(url);

/**
 * CHEESECrypt's sole signed-broadcast transport when its loopback helper is
 * explicitly exclusive. Remote Hyperion servers and other dApps are untouched.
 */
export function cryptTorBroadcastEndpoint(pathname = typeof window !== 'undefined' ? window.location.pathname : ''): string | null {
  const custom = loadCustomEndpoint();
  if (!custom || !loadCustomOnly() || !isLoopback(custom) || !/\/crypt\/?$/.test(pathname)) return null;
  return custom;
}

export function saveCustomEndpoint(url: string | null, only: boolean) {
  write(NODE_KEY, url);
  saveCustomOnlyPreference(!!url && only);
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
    const aborted = typeof e === 'object' && e !== null && 'name' in e && e.name === 'AbortError';
    const error = aborted
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

/**
 * First-run privacy gate (device-local). Until the user picks, CHEESECrypt mounts no
 * messenger, so no history reads naming their account are made from this browser.
 * 'private' stays satisfied only while an exclusive custom server is saved; if it is
 * removed the gate returns instead of silently falling back to public servers.
 */
export type PrivacyGateChoice = 'public' | 'private';
const GATE_KEY = 'cheesecrypt-privacy-gate';
export const loadPrivacyGateChoice = (): PrivacyGateChoice | null => {
  const v = read(GATE_KEY);
  return v === 'public' || v === 'private' ? v : null;
};
export const savePrivacyGateChoice = (c: PrivacyGateChoice | null) => write(GATE_KEY, c);
export const privacyGateSatisfied = (): boolean => {
  if (loadCustomOnly()) return true;
  return loadPrivacyGateChoice() === 'public';
};

// Optional send jitter: a random local delay before signing, so block times don't line up with incoming messages.
// Device-local only; the timer runs in this tab and nothing is sent anywhere while waiting.
/** mode: 'off' everywhere, 'chat' only in chats switched on from their ⋯ Privacy menu, 'all' in every chat (master switch).
 * chats holds `account|chatId` keys and is kept even while the master switch is off or 'all'. */
export type JitterMode = 'off' | 'chat' | 'all';
export type SendJitter = { mode: JitterMode; chats: string[]; minSeconds: number; maxSeconds: number };
export const JITTER_EVENT = 'cheesecrypt-send-jitter-changed';
const JITTER_KEY = 'cheesecrypt-send-jitter';
export const JITTER_LIMITS = { min: 1, max: 120 } as const;
export const DEFAULT_JITTER: SendJitter = { mode: 'off', chats: [], minSeconds: 5, maxSeconds: 25 };
export const JITTER_PRESETS = [
  { label: 'Short', minSeconds: 3, maxSeconds: 10 },
  { label: 'Medium', minSeconds: 5, maxSeconds: 25 },
  { label: 'Long', minSeconds: 15, maxSeconds: 60 },
] as const;
/** Clamp to whole seconds within 1–120 and keep min ≤ max. */
export function normalizeJitter(j: (Partial<SendJitter> & { enabled?: unknown }) | null | undefined): SendJitter {
  const clamp = (v: unknown, d: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : d;
    return Math.min(JITTER_LIMITS.max, Math.max(JITTER_LIMITS.min, n));
  };
  let minSeconds = clamp(j?.minSeconds, DEFAULT_JITTER.minSeconds);
  let maxSeconds = clamp(j?.maxSeconds, DEFAULT_JITTER.maxSeconds);
  if (minSeconds > maxSeconds) [minSeconds, maxSeconds] = [maxSeconds, minSeconds];
  // Older saves had one on/off switch that applied everywhere.
  const mode: JitterMode = j?.mode === 'chat' || j?.mode === 'all' || j?.mode === 'off' ? j.mode : j?.enabled === true ? 'all' : 'off';
  const chats = Array.isArray(j?.chats) ? [...new Set(j!.chats.filter((c): c is string => typeof c === 'string' && c.length > 0 && c.length <= 300))].slice(0, 2000) : [];
  return { mode, chats, minSeconds, maxSeconds };
}
export const loadSendJitter = (): SendJitter => {
  const raw = read(JITTER_KEY);
  if (!raw) return { ...DEFAULT_JITTER };
  try { return normalizeJitter(JSON.parse(raw)); } catch { return { ...DEFAULT_JITTER }; }
};
export const saveSendJitter = (j: SendJitter): SendJitter => {
  const n = normalizeJitter(j); write(JITTER_KEY, JSON.stringify(n));
  try { window.dispatchEvent(new Event(JITTER_EVENT)); } catch { /* no window */ }
  return n;
};
export const jitterChatKey = (account: string, chat: string) => `${account}|${chat}`;
/** Whether a send from this account in this chat waits a random delay. */
export const isJitterOnForChat = (j: SendJitter, account: string, chat: string) =>
  j.mode === 'all' || (j.mode === 'chat' && j.chats.includes(jitterChatKey(account, chat)));
/** Per-chat switch from the chat's ⋯ Privacy menu; switching one on while the master switch is off turns on per-chat mode. */
export function setChatJitter(j: SendJitter, account: string, chat: string, on: boolean): SendJitter {
  const k = jitterChatKey(account, chat);
  const chats = on ? [...j.chats.filter(c => c !== k), k] : j.chats.filter(c => c !== k);
  return { ...j, chats, mode: on && j.mode === 'off' ? 'chat' : j.mode };
}
/** Whole-second delay in [min, max] inclusive; `rand` is injectable for tests. */
export function pickJitterSeconds(j: SendJitter, rand: () => number = () => {
  const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 2 ** 32;
}): number {
  const n = normalizeJitter(j);
  return n.minSeconds + Math.floor(rand() * (n.maxSeconds - n.minSeconds + 1));
}
