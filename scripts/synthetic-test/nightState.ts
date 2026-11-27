/** Local progress is committed before signing; failed storage never permits a send. */
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { nightKey, upcomingNightKey, nightBounds, planNight, NIGHT_LATE_MS, type NightConfig, type NightEntry } from './policy';

export function writeJsonAtomic(path: string, value: unknown) {
  const temp = `${path}.${process.pid}.tmp`;
  try { writeFileSync(temp, JSON.stringify(value), { mode: 0o600 }); renameSync(temp, path); }
  finally { if (existsSync(temp)) unlinkSync(temp); }
}

/** Fail closed if a second process starts, including after an unclean shutdown. */
export function lockRunner(path: string): () => void {
  const lock = `${path}.lock`;
  const fd = openSync(lock, 'wx', 0o600);
  closeSync(fd);
  return () => { if (existsSync(lock)) unlinkSync(lock); };
}

export interface NightState { fingerprint: string; key: string; plan: NightEntry[]; done: string[] }
export function nightFingerprint(night: NightConfig, accounts: string[]): string {
  return createHash('sha256').update(JSON.stringify({ night, accounts })).digest('hex');
}
export function readNightState(path: string, fingerprint: string, accounts: string[], n: NightConfig): NightState | null {
  if (!existsSync(path)) return null;
  const s = JSON.parse(readFileSync(path, 'utf8')) as NightState;
  if (s?.fingerprint !== fingerprint) throw new Error('Night configuration changed; use a new private configuration/state file rather than replaying this schedule');
  if (typeof s.key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.key) || !Array.isArray(s.plan) || !Array.isArray(s.done)) throw new Error('Invalid night progress; refusing to reset it');
  const bounds = nightBounds(s.key, n);
  const ids = new Set<string>();
  for (const e of s.plan) {
    if (!e || typeof e.id !== 'string' || ids.has(e.id) || !Number.isFinite(e.atMs) || e.atMs < bounds.startMs || e.atMs >= bounds.endMs || !accounts.includes(e.sender) || !accounts.includes(e.recipient) || e.sender === e.recipient) throw new Error('Invalid night plan; refusing to send');
    ids.add(e.id);
  }
  if (!s.done.every(id => typeof id === 'string' && ids.has(id))) throw new Error('Invalid night progress IDs');
  return s;
}

/** Clock-only scheduler; no history polling, trickle timers or reactive batches. */
export function createNightScheduler(options: {
  night: NightConfig; accounts: string[]; state: NightState | null;
  now: () => number; rand: () => number;
  persist: (s: NightState) => void;
  send: (sender: string, recipient: string) => Promise<void>;
  onPlan?: (s: NightState) => void;
}) {
  let state = options.state;
  let busy = false;
  return {
    getState: () => state,
    async tick() {
      if (busy || !options.night.enabled) return;
      busy = true;
      try {
        const key = upcomingNightKey(options.now(), options.night);
        // A clock rewind must not recreate a window that was already replaced.
        if (state && key < state.key) return;
        if (state?.key !== key) {
          state = { fingerprint: nightFingerprint(options.night, options.accounts), key, plan: planNight(options.night, options.accounts, key, options.rand), done: [] };
          options.persist(state);
          options.onPlan?.(state);
        }
        const current = state;
        if (nightKey(options.now(), options.night) !== current.key) return;
        for (const e of current.plan) {
          if (current.done.includes(e.id) || e.atMs > options.now()) continue;
          current.done.push(e.id);
          options.persist(current); // throws before send if the disk is unavailable
          if (options.now() - e.atMs > NIGHT_LATE_MS || nightKey(options.now(), options.night) !== current.key) continue;
          await options.send(e.sender, e.recipient);
        }
      } finally { busy = false; }
    },
  };
}