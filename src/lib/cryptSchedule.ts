// Per-message scheduled send: a local, in-tab timer that runs the unchanged send at a chosen later time,
// so when a message reaches the chain is decoupled from when it was written. Nothing is stored or sent while waiting.
export const SCHEDULE_MAX_MS = 24 * 60 * 60 * 1000;
export const SCHEDULE_PRESETS = [
  { label: 'In 15 minutes', minutes: 15 },
  { label: 'In 1 hour', minutes: 60 },
  { label: 'In 3 hours', minutes: 180 },
  { label: 'In 8 hours', minutes: 480 },
] as const;

/** Next local occurrence of "HH:MM" after `now` (today, else tomorrow); null if malformed. Always within 24h. */
export function nextLocalTime(hhmm: string, now: number = Date.now()): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date(now); d.setHours(h, min, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** Whole seconds remaining (never negative); based on wall clock so a throttled background tab still fires on time once it wakes. */
export const secondsLeft = (until: number, now: number = Date.now()) => Math.max(0, Math.ceil((until - now) / 1000));

/** "45s", "12m 05s", "2h 03m". */
export function formatLeft(s: number): string {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(sec).padStart(2, '0')}s`;
}
