/** Screen Shield & Panic Lock: device-local settings and pure helpers. */
export const IDLE_OPTIONS = [0, 15, 30, 60] as const; // minutes; 0 = off
export type IdleMinutes = typeof IDLE_OPTIONS[number];
export const DEFAULT_IDLE_MINUTES: IdleMinutes = 30;
export const DOUBLE_ESC_MS = 600;

const IDLE_STORE = 'cheesecrypt-autolock-minutes';
const SHIELD_STORE = 'cheesecrypt-screen-shield';

export function loadIdleMinutes(): IdleMinutes {
  try {
    const raw = localStorage.getItem(IDLE_STORE);
    if (raw === null) return DEFAULT_IDLE_MINUTES;
    const n = Number(raw);
    return (IDLE_OPTIONS as readonly number[]).includes(n) ? n as IdleMinutes : DEFAULT_IDLE_MINUTES;
  } catch { return DEFAULT_IDLE_MINUTES; }
}
export const saveIdleMinutes = (m: IdleMinutes) => { try { localStorage.setItem(IDLE_STORE, String(m)); } catch { /* ignore */ } };
export const loadShield = () => { try { return localStorage.getItem(SHIELD_STORE) === '1'; } catch { return false; } };
export const saveShield = (on: boolean) => { try { localStorage.setItem(SHIELD_STORE, on ? '1' : '0'); } catch { /* ignore */ } };

/** True once `minutes` of inactivity have fully passed. 0 never expires. */
export function idleExpired(lastActive: number, minutes: number, now: number): boolean {
  return minutes > 0 && now - lastActive >= minutes * 60_000;
}

/** Returns a function fed with Esc press times; true when two land within DOUBLE_ESC_MS. */
export function createDoubleEscDetector() {
  let last = -Infinity;
  return (now: number) => {
    if (now - last <= DOUBLE_ESC_MS) { last = -Infinity; return true; }
    last = now;
    return false;
  };
}
