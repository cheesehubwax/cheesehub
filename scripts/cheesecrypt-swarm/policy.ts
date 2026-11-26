/**
 * Pure rules for the CHEESECrypt cover-traffic swarm. No I/O here, so every amount,
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

/** A decoy memo is random bytes laid out exactly like a padded CRYPT2 ciphertext (nonce 24 + box). */
export function dummyMemo(random: (n: number) => Uint8Array): string {
  const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
  return `${PREFIX}${b64(random(24))}:${b64(random(boxBytes()))}`;
}

export const cheese = (units: number) => `${(units / 10000).toFixed(4)} CHEESE`;
export function cheeseUnits(asset: string): number {
  const m = /^(\d+)\.(\d{4}) CHEESE$/.exec(asset.trim());
  return m ? Number(m[1]) * 10000 + Number(m[2]) : NaN;
}

/** Exact router shape the app uses for a one-part, one-recipient message (payment then sendmsg). */
export function buildSend(sender: string, permission: string, to: string, memo: string) {
  if (sender === to) throw new Error('crypt.cheese rejects messages to self');
  const authorization = [{ actor: sender, permission }];
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
export function refuseSend(sentToday: number, maxPerDay: number, balanceUnits: number, reserveUnits: number): string | null {
  if (sentToday >= maxPerDay) return 'daily cap reached';
  if (!Number.isSafeInteger(balanceUnits)) return 'balance unknown';
  if (balanceUnits - SEND_COST_UNITS < reserveUnits) return 'would go below reserve';
  return null;
}
export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Sliding one-hour window of burst start times. */
export function burstAllowed(starts: number[], now: number, maxPerHour: number): boolean {
  return starts.filter(t => now - t < 3_600_000).length < maxPerHour;
}

/** Linked actions the dedicated permission must have, and nothing broader. */
export const REQUIRED_LINKS = [`${TOKEN}::transfer`, `${ROUTER}::sendmsg`];
export function checkPermission(account: { permissions?: { perm_name: string; required_auth: { keys: { key: string }[] }; linked_actions?: { account: string; action?: string }[] }[] }, permission: string, publicKeys: string[]): string | null {
  const perms = account?.permissions ?? [];
  const p = perms.find(x => x.perm_name === permission);
  if (!p) return `permission ${permission} not found`;
  const keyMatch = (x: { required_auth: { keys: { key: string }[] } }) => x.required_auth.keys.some(k => publicKeys.includes(k.key));
  if (!keyMatch(p)) return `configured key is not on ${permission}`;
  for (const high of perms.filter(x => x.perm_name === 'owner' || x.perm_name === 'active')) if (keyMatch(high)) return `configured key is also on ${high.perm_name} — refuse (too much authority)`;
  if (p.linked_actions) {
    const links = p.linked_actions.map(l => `${l.account}::${l.action ?? '*'}`);
    if (links.some(l => !REQUIRED_LINKS.includes(l))) return `${permission} is linked to more than ${REQUIRED_LINKS.join(' and ')}`;
    const missing = REQUIRED_LINKS.filter(l => !links.includes(l));
    if (missing.length) return `${permission} is missing linkauth for ${missing.join(', ')}`;
  }
  return null;
}
