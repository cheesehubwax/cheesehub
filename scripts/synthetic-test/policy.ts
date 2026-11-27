/**
 * Pure rules for the CHEESECrypt synthetic test. No I/O here, so every amount,
 * timing and shape decision is unit-tested (policy.test.ts).
 */
export const ROUTER = 'crypt.cheese';
export const TOKEN = 'cheeseburger';
export const FEE_MEMO = 'CHEESECrypt messaging fee';
/** One single-part message via the router: 0.0100 fee + 0.0001 recipient copy, in integer CHEESE units. */
export const SEND_COST_UNITS = 101;
export const MEMO_MAX_BYTES = 256;
const PREFIX = 'CRYPT2:';

/** Same sizing rule as the app's rawCapacity: real padded memos always have this exact length. */
export function boxBytes(budget = MEMO_MAX_BYTES): number {
  for (let n = 256; n > 0; n--) if (PREFIX.length + 32 + 1 + 4 * Math.ceil((n + 16) / 3) <= budget) return n + 16;
  return 0;
}

/** A sample memo is random bytes laid out exactly like a padded CRYPT2 ciphertext (nonce 24 + box). */
export function dummyMemo(random: (n: number) => Uint8Array): string {
  const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
  return `${PREFIX}${b64(random(24))}:${b64(random(boxBytes()))}`;
}

export const cheese = (units: number) => `${(units / 10000).toFixed(4)} CHEESE`;
export function cheeseUnits(asset: string): number {
  const m = /^(\d+)\.(\d{4}) CHEESE$/.exec(asset.trim());
  return m ? Number(m[1]) * 10000 + Number(m[2]) : NaN;
}

/** Contract per-part platform fee the sponsor pays for a free message (0.0100 CHEESE). */
export const SPONSOR_PART_UNITS = 100;
export const SPONSOR_WINDOW_SEC = 86400;

export interface Budget { dailyLimit: number; windowStart: number; spent: number; sponsorBalance: number; funder: string; enabled: boolean }
const units = (a: unknown) => (typeof a === 'string' ? cheeseUnits(a) : NaN);
/** Same validation as the app's parseBudget: anything malformed means "not sponsored". */
export function parseBudget(row: unknown): Budget | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const b: Budget = { dailyLimit: units(r.daily_limit), windowStart: Number(r.window_start), spent: units(r.spent),
    sponsorBalance: units(r.sponsor_balance), funder: typeof r.funder === 'string' ? r.funder : '', enabled: r.enabled === true || r.enabled === 1 };
  return [b.dailyLimit, b.windowStart, b.spent, b.sponsorBalance].every(n => Number.isSafeInteger(n) && n >= 0) ? b : null;
}
/** Same rule as the app and contract: units the sponsor can still cover right now (0 when off or used up). */
export function sponsorRemaining(b: Budget | null, nowSec: number): number {
  if (!b || !b.enabled || !b.funder) return 0;
  const fresh = b.windowStart === 0 || (nowSec >= b.windowStart && nowSec - b.windowStart >= SPONSOR_WINDOW_SEC);
  return Math.max(0, Math.min(b.dailyLimit - (fresh ? 0 : b.spent), b.sponsorBalance));
}

/**
 * Exactly what the app signs for a one-part, one-recipient message: a lone `sendfree` when the live
 * sponsor budget covers it (as Instant Messaging users send), otherwise payment then `sendmsg`.
 */
export function buildSend(sender: string, permission: string, to: string, memo: string, free = false) {
  if (sender === to) throw new Error('crypt.cheese rejects messages to self');
  const authorization = [{ actor: sender, permission }];
  if (free) return [{ account: ROUTER, name: 'sendfree', authorization, data: { sender, parts: 1, copies: [{ to, memo }] } }];
  return [
    { account: TOKEN, name: 'transfer', authorization, data: { from: sender, to: ROUTER, quantity: cheese(SEND_COST_UNITS), memo: FEE_MEMO } },
    { account: ROUTER, name: 'sendmsg', authorization, data: { sender, parts: 1, copies: [{ to, memo }] } },
  ];
}

export interface Bot { account: string; permission: string; privateKey: string }
export interface Config {
  bots: Bot[];
  /** Average background messages per bot per hour (Poisson trickle). */
  trickleRatePerHour: number;
  /** Reactive bursts: how many bots answer an organic CHEESECrypt send, and their stagger window. */
  burstMin: number; burstMax: number; burstDelayMinSeconds: number; burstDelayMaxSeconds: number;
  /** At most this many bursts start per hour, whatever the network does. */
  maxBurstsPerHour: number;
  /** Hard caps per bot per UTC day. */
  maxSendsPerBotPerDay: number;
  /** Never let a bot's CHEESE fall below this (integer string like "1.0000 CHEESE"). */
  reserve: string;
  chainApi: string[];
  hyperion: string[];
  /** "direct" or a local CHEESECrypt Tor helper address (http://127.0.0.1:PORT). */
  broadcast: string;
  /** Hyperion reads through the Tor helper too, when set. */
  historyViaHelper?: string;
  /** Optional quiet-hours schedule (see NightConfig). */
  night?: NightConfig;
}

export interface NightConfig {
  enabled: boolean;
  /** IANA timezone, e.g. "Australia/Brisbane". */
  timezone: string;
  /** Local "HH:MM"; the window may cross midnight. */
  start: string; end: string;
  sendsMin: number; sendsMax: number;
  /** Chance (0–1) that a whole night has no sends. */
  skipNightChance: number;
  /** Chance (0–1) that the recipient answers. */
  replyChance: number;
  replyDelayMinSeconds: number; replyDelayMaxSeconds: number;
  /** Which configured accounts may start night sends. */
  senders: string[];
}

const NAME = /^[a-z1-5.]{1,12}$/;
const bad = (m: string) => { throw new Error(`Config: ${m}`); };
const num = (v: unknown, lo: number, hi: number, label: string) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) bad(`${label} must be between ${lo} and ${hi}`);
  return v as number;
};
const loopback = (u: string) => { try { const x = new URL(u); return x.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(x.hostname); } catch { return false; } };

export function validateConfig(raw: unknown): Config {
  const c = raw as Config;
  if (!c || !Array.isArray(c.bots) || c.bots.length < 2) bad('at least 2 bots are needed (bots cannot message themselves)');
  const seen = new Set<string>();
  for (const b of c.bots) {
    if (!b || !NAME.test(b.account) || b.account.endsWith('.')) bad(`invalid account "${b?.account}"`);
    if (seen.has(b.account)) bad(`duplicate account ${b.account}`);
    seen.add(b.account);
    if (!NAME.test(b.permission) || ['owner', 'active'].includes(b.permission)) bad(`${b.account}: use a dedicated permission, never owner/active`);
    if (typeof b.privateKey !== 'string' || !/^PVT_K1_|^5[HJK]/.test(b.privateKey)) bad(`${b.account}: privateKey missing or malformed`);
  }
  num(c.trickleRatePerHour, 0, 6, 'trickleRatePerHour');
  num(c.burstMin, 0, c.bots.length - 1, 'burstMin');
  num(c.burstMax, c.burstMin, c.bots.length, 'burstMax');
  num(c.burstDelayMinSeconds, 5, 3600, 'burstDelayMinSeconds');
  num(c.burstDelayMaxSeconds, c.burstDelayMinSeconds, 3600, 'burstDelayMaxSeconds');
  num(c.maxBurstsPerHour, 0, 30, 'maxBurstsPerHour');
  num(c.maxSendsPerBotPerDay, 1, 500, 'maxSendsPerBotPerDay');
  if (!Number.isSafeInteger(cheeseUnits(c.reserve))) bad('reserve must look like "1.0000 CHEESE"');
  if (!Array.isArray(c.chainApi) || !c.chainApi.length || !c.chainApi.every(u => /^https:\/\//.test(u))) bad('chainApi needs HTTPS endpoints');
  if (!Array.isArray(c.hyperion) || !c.hyperion.length || !c.hyperion.every(u => /^https:\/\//.test(u))) bad('hyperion needs HTTPS endpoints');
  if (c.broadcast !== 'direct' && !loopback(c.broadcast)) bad('broadcast must be "direct" or a loopback Tor helper address');
  if (c.historyViaHelper !== undefined && !loopback(c.historyViaHelper)) bad('historyViaHelper must be a loopback address');
  if (c.night !== undefined) validateNight(c.night, seen);
  return c;
}

/** Exponential gap (ms) for a Poisson process; u in [0,1). Rate 0 never fires. */
export function poissonDelayMs(ratePerHour: number, u: number): number {
  if (ratePerHour <= 0) return Infinity;
  return Math.max(1000, Math.round(-Math.log(1 - u) / ratePerHour * 3_600_000));
}

/** Uniform integer in [lo, hi] from u in [0,1). */
export const pickInt = (lo: number, hi: number, u: number) => lo + Math.min(hi - lo, Math.floor(u * (hi - lo + 1)));

/** Another bot, never the sender. */
export function pickRecipient(accounts: string[], sender: string, u: number): string {
  const others = accounts.filter(a => a !== sender);
  if (!others.length) throw new Error('no recipient available');
  return others[pickInt(0, others.length - 1, u)];
}

/** A burst: distinct random senders, each with its own staggered delay (ms), sorted by time. */
export function planBurst(c: Config, rand: () => number): { sender: string; delayMs: number }[] {
  const count = pickInt(c.burstMin, c.burstMax, rand());
  const pool = c.bots.map(b => b.account);
  for (let i = pool.length - 1; i > 0; i--) { const j = pickInt(0, i, rand()); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count)
    .map(sender => ({ sender, delayMs: pickInt(c.burstDelayMinSeconds, c.burstDelayMaxSeconds, rand()) * 1000 }))
    .sort((a, b) => a.delayMs - b.delayMs);
}

/** An organic trigger is a router delivery authorized by someone who is not one of our bots. */
export function isOrganic(action: { act?: { name?: string; authorization?: { actor?: string }[] } }, bots: Set<string>): boolean {
  const a = action?.act;
  if (!a || (a.name !== 'sendmsg' && a.name !== 'sendfree')) return false;
  const actors = (a.authorization ?? []).map(x => String(x?.actor));
  return actors.length > 0 && actors.every(x => !bots.has(x));
}

/** Per-UTC-day counter and balance gate; returns why a send is refused, or null when allowed. */
export function refuseSend(sentToday: number, maxPerDay: number, balanceUnits: number, reserveUnits: number, costUnits = SEND_COST_UNITS): string | null {
  if (sentToday >= maxPerDay) return 'daily cap reached';
  if (costUnits === 0) return null;
  if (!Number.isSafeInteger(balanceUnits)) return 'balance unknown';
  if (balanceUnits - costUnits < reserveUnits) return 'would go below reserve';
  return null;
}
export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Sliding one-hour window of burst start times. */
export function burstAllowed(starts: number[], now: number, maxPerHour: number): boolean {
  return starts.filter(t => now - t < 3_600_000).length < maxPerHour;
}

/** Linked actions the dedicated permission must have, and nothing broader. */
export const REQUIRED_LINKS = [`${TOKEN}::transfer`, `${ROUTER}::sendmsg`, `${ROUTER}::sendfree`];
type ChainAccount = { permissions?: { perm_name: unknown; required_auth?: { keys?: { key: unknown }[] }; linked_actions?: { account: unknown; action?: unknown }[] }[] };
/**
 * Chain libraries return names and keys as objects, so everything is compared as strings;
 * keys match in either PUB_K1_ or legacy EOS form.
 */
export function checkPermission(account: ChainAccount, permission: string, publicKeys: string[]): string | null {
  const perms = account?.permissions ?? [];
  const p = perms.find(x => String(x.perm_name) === permission);
  if (!p) return `permission ${permission} not found`;
  const wanted = publicKeys.map(String);
  const forms = (k: unknown) => { const o = k as { toLegacyString?: () => string }; return [String(k), typeof o?.toLegacyString === 'function' ? o.toLegacyString() : '']; };
  const keyMatch = (x: { required_auth?: { keys?: { key: unknown }[] } }) => (x.required_auth?.keys ?? []).some(k => forms(k.key).some(f => f && wanted.includes(f)));
  if (!keyMatch(p)) return `configured key is not on ${permission}`;
  for (const high of perms.filter(x => ['owner', 'active'].includes(String(x.perm_name)))) if (keyMatch(high)) return `configured key is also on ${String(high.perm_name)} — refuse (too much authority)`;
  if (p.linked_actions) {
    const links = p.linked_actions.map(l => `${String(l.account)}::${l.action == null ? '*' : String(l.action)}`);
    if (links.some(l => !REQUIRED_LINKS.includes(l))) return `${permission} is linked to more than ${REQUIRED_LINKS.join(', ')}`;
    const missing = REQUIRED_LINKS.filter(l => !links.includes(l));
    if (missing.length) return `${permission} is missing linkauth for ${missing.join(', ')}`;
  }
  return null;
}

// ---- Auto-powerup via CHEESEUp (cheesepowerz): a plain CHEESE transfer, already covered by the transfer link ----
export const POWERZ = 'cheesepowerz';
/** 0.0100 CHEESE per powerup lot, in integer units. */
export const POWERUP_UNITS = 100;
/** Below this many microseconds of available CPU a bot tops itself up. */
export const CPU_LOW_US = 2000;
/** Below this a bot may be unable to sign at all, so another bot pays for it. */
export const CPU_STUCK_US = 500;
/** At most one powerup per target in this window, so a slow read never causes repeat buys. */
export const POWERUP_COOLDOWN_MS = 6 * 3_600_000;

/** cheesepowerz reads the memo as the receiving account (default CPU split). */
export function buildPowerup(payer: string, permission: string, target: string) {
  return [{ account: TOKEN, name: 'transfer', authorization: [{ actor: payer, permission }],
    data: { from: payer, to: POWERZ, quantity: cheese(POWERUP_UNITS), memo: target } }];
}

/**
 * Who pays to power up `target`, or null. Unknown CPU never triggers a buy. A bot that is low pays for
 * itself; one that is stuck is rescued by the bot with the most CPU that is itself not low.
 */
export function planPowerup(target: string, cpu: Record<string, number | null>, lastPowerupMs: number | undefined, nowMs: number): { payer: string; target: string } | null {
  const mine = cpu[target];
  if (mine == null || !Number.isFinite(mine) || mine >= CPU_LOW_US) return null;
  if (lastPowerupMs !== undefined && nowMs - lastPowerupMs < POWERUP_COOLDOWN_MS) return null;
  if (mine >= CPU_STUCK_US) return { payer: target, target };
  const buddy = Object.entries(cpu)
    .filter(([a, v]) => a !== target && v != null && Number.isFinite(v) && v >= CPU_LOW_US)
    .sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  return buddy ? { payer: buddy[0], target } : null;
}

// ---- Night schedule: a few random sends inside the user's local quiet window ----
const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function parseHM(v: string): number { const m = HM.exec(v); if (!m) return NaN; return Number(m[1]) * 60 + Number(m[2]); }

function validateNight(n: NightConfig, accounts: Set<string>) {
  if (!n || typeof n !== 'object') bad('night must be an object');
  if (typeof n.enabled !== 'boolean') bad('night.enabled must be true or false');
  try { new Intl.DateTimeFormat('en-US', { timeZone: n.timezone }); } catch { bad(`night.timezone "${n.timezone}" is not a valid timezone`); }
  if (typeof n.timezone !== 'string' || !n.timezone) bad('night.timezone is required');
  if (Number.isNaN(parseHM(n.start))) bad('night.start must look like "23:00"');
  if (Number.isNaN(parseHM(n.end))) bad('night.end must look like "06:30"');
  if (n.start === n.end) bad('night.start and night.end must differ');
  num(n.sendsMin, 0, 20, 'night.sendsMin');
  num(n.sendsMax, n.sendsMin, 20, 'night.sendsMax');
  num(n.skipNightChance, 0, 1, 'night.skipNightChance');
  num(n.replyChance, 0, 1, 'night.replyChance');
  num(n.replyDelayMinSeconds, 30, 3600, 'night.replyDelayMinSeconds');
  num(n.replyDelayMaxSeconds, n.replyDelayMinSeconds, 3600, 'night.replyDelayMaxSeconds');
  if (!Array.isArray(n.senders) || !n.senders.length) bad('night.senders needs at least one account');
  for (const a of n.senders) if (!accounts.has(a)) bad(`night.senders: ${a} is not in bots (add it there with its own cheesecrypt key)`);
}

/** Local calendar date and minute-of-day for an instant in a timezone. */
export function localParts(ms: number, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, minutes: p.hour * 60 + p.minute, s: p.second };
}
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
export const addDays = (key: string, n: number) => new Date(Date.parse(key + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

/** UTC instant of a local date + minute in a timezone (DST-safe for times that exist). */
export function zonedToUtc(key: string, minutes: number, tz: string): number {
  const guess = Date.parse(key + 'T00:00:00Z') + minutes * 60_000;
  const offsetAt = (ms: number) => { const l = localParts(ms, tz); return Date.UTC(l.y, l.m - 1, l.d, 0, l.minutes, l.s) - Math.floor(ms / 1000) * 1000; };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return t;
}

/** Key (local start date) of the window containing now, else null. */
export function nightKey(nowMs: number, n: Pick<NightConfig, 'timezone' | 'start' | 'end'>): string | null {
  const l = localParts(nowMs, n.timezone), s = parseHM(n.start), e = parseHM(n.end), today = iso(l.y, l.m, l.d);
  if (s < e) return l.minutes >= s && l.minutes < e ? today : null;
  if (l.minutes >= s) return today;
  if (l.minutes < e) return addDays(today, -1);
  return null;
}
/** The current window's key, or the next one to start. */
export function upcomingNightKey(nowMs: number, n: Pick<NightConfig, 'timezone' | 'start' | 'end'>): string {
  const cur = nightKey(nowMs, n); if (cur) return cur;
  const l = localParts(nowMs, n.timezone), today = iso(l.y, l.m, l.d);
  return l.minutes < parseHM(n.start) ? today : addDays(today, 1);
}
export function nightBounds(key: string, n: Pick<NightConfig, 'timezone' | 'start' | 'end'>) {
  const s = parseHM(n.start), e = parseHM(n.end);
  return { startMs: zonedToUtc(key, s, n.timezone), endMs: zonedToUtc(s < e ? key : addDays(key, 1), e, n.timezone) };
}

export interface NightEntry { id: string; atMs: number; sender: string; recipient: string }

/** Tonight's sends: random count, random times (never on a round minute), random pairs, optional replies inside the window. */
export function planNight(n: NightConfig, accounts: string[], key: string, rand: () => number): NightEntry[] {
  if (!n.enabled || rand() < n.skipNightChance) return [];
  const { startMs, endMs } = nightBounds(key, n);
  const span = endMs - startMs;
  const count = pickInt(n.sendsMin, n.sendsMax, rand());
  const out: NightEntry[] = [];
  for (let i = 0; i < count; i++) {
    let at = startMs + Math.floor(rand() * span);
    if (at % 60_000 < 1000) at += 1000 + Math.floor(rand() * 58_000);
    if (at >= endMs) at = endMs - 1001;
    const sender = n.senders[Math.min(n.senders.length - 1, Math.floor(rand() * n.senders.length))];
    const recipient = pickRecipient(accounts, sender, rand());
    out.push({ id: `${key}:${i}`, atMs: at, sender, recipient });
    if (rand() < n.replyChance) {
      let r = at + pickInt(n.replyDelayMinSeconds, n.replyDelayMaxSeconds, rand()) * 1000 + Math.floor(rand() * 1000);
      if (r % 60_000 < 1000) r += 1000 + Math.floor(rand() * 58_000);
      if (r < endMs) out.push({ id: `${key}:${i}r`, atMs: r, sender: recipient, recipient: sender });
    }
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}

/** Overdue beyond this (e.g. after a restart) is dropped, never bunched. */
export const NIGHT_LATE_MS = 10 * 60_000;
export function dueNight(plan: NightEntry[], done: Set<string>, nowMs: number): { due: NightEntry[]; dropped: NightEntry[] } {
  const due: NightEntry[] = [], dropped: NightEntry[] = [];
  for (const e of plan) {
    if (done.has(e.id) || e.atMs > nowMs) continue;
    (nowMs - e.atMs > NIGHT_LATE_MS ? dropped : due).push(e);
  }
  return { due, dropped };
}
