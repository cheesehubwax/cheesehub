/**
 * Sponsored (free) CHEESECrypt messages. crypt.cheese pays the per-part platform fee (80% nulled / 20%
 * xcheeseliqst) from an operator-funded sponsor balance, capped per 24-hour chain-time window, through
 * `sendfree`. The sender's transaction then carries no token transfer at all.
 *
 * Safety switch: the app only builds `sendfree` after reading a live, enabled `budget` row from the
 * deployed contract. Before that version is deployed (no table) or while it is switched off, every send
 * stays on the paid `sendmsg` path, so wallets never sign an action the contract does not have.
 */
import { fetchTable } from './wax';
import { CRYPT_ROUTER_ACCOUNT, FEE_MEMO } from './cheeseCrypt';

export const SPONSOR_WINDOW_SEC = 86400;
/** Contract per-part platform fee in token units (0.0100 CHEESE). */
export const SPONSOR_PART_UNITS = 100;

export interface SponsorBudget {
  dailyLimit: number;     // units
  windowStart: number;    // chain UTC seconds
  spent: number;          // units in the current window
  sponsorBalance: number; // units
  funder: string;
  enabled: boolean;
}

const assetUnits = (a: unknown): number => {
  if (typeof a !== 'string' || !/^\d+\.\d{4} CHEESE$/.test(a.trim())) return NaN;
  const [w, f] = a.trim().split(' ')[0].split('.');
  return Number(w) * 10000 + Number(f);
};

/** Validates a raw `budget` table row; anything malformed is treated as no sponsorship. */
export function parseBudget(row: unknown): SponsorBudget | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const b: SponsorBudget = {
    dailyLimit: assetUnits(r.daily_limit), windowStart: Number(r.window_start), spent: assetUnits(r.spent),
    sponsorBalance: assetUnits(r.sponsor_balance), funder: typeof r.funder === 'string' ? r.funder : '',
    enabled: r.enabled === true || r.enabled === 1,
  };
  if (![b.dailyLimit, b.windowStart, b.spent, b.sponsorBalance].every(n => Number.isSafeInteger(n) && n >= 0)) return null;
  return b;
}

/** Same window rule as the contract: a fresh window opens once a full day has passed. */
export function windowStartAt(nowSec: number, start: number): number {
  if (start === 0) return nowSec;
  if (nowSec < start) return start;
  return nowSec - start >= SPONSOR_WINDOW_SEC ? nowSec : start;
}

/** Units crypt.cheese can still sponsor right now (0 when off, unfunded or the day's cap is used). */
export function sponsorRemaining(b: SponsorBudget | null, nowSec = Math.floor(Date.now() / 1000)): number {
  if (!b || !b.enabled || !b.funder) return 0;
  const spent = windowStartAt(nowSec, b.windowStart) !== b.windowStart ? 0 : b.spent;
  return Math.max(0, Math.min(b.dailyLimit - spent, b.sponsorBalance));
}

let cached: { at: number; budget: SponsorBudget | null } | null = null;
const CACHE_MS = 30_000;

/** Live budget row (cached briefly). Any read failure means "not sponsored" so sending falls back to paid. */
export async function fetchSponsorBudget(force = false): Promise<SponsorBudget | null> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.budget;
  let budget: SponsorBudget | null = null;
  try {
    const rows = await fetchTable<unknown>(CRYPT_ROUTER_ACCOUNT, CRYPT_ROUTER_ACCOUNT, 'budget', { limit: 1 });
    budget = parseBudget(rows[0]);
  } catch { budget = null; }
  cached = { at: Date.now(), budget };
  return budget;
}
export const invalidateSponsorBudget = () => { cached = null; };

type Act = { account?: string; name?: string; authorization?: unknown; data?: Record<string, unknown> };

/**
 * Turns an exact routed message ([payment to crypt.cheese, sendmsg] and nothing else) into one
 * `sendfree` with identical copies, when the remaining budget covers its platform fee. Every other
 * shape (voice is excluded by the caller, tips, payfee, direct legs) is returned unchanged.
 */
export function sponsorCryptActions<T>(actions: T[], remainingUnits: number): T[] | Record<string, unknown>[] {
  if (actions.length !== 2) return actions;
  const [pay, msg] = actions as unknown as Act[];
  if (pay?.account !== 'cheeseburger' || pay.name !== 'transfer' || pay.data?.to !== CRYPT_ROUTER_ACCOUNT || pay.data?.memo !== FEE_MEMO) return actions;
  if (msg?.account !== CRYPT_ROUTER_ACCOUNT || msg.name !== 'sendmsg') return actions;
  const { sender, parts, copies } = msg.data ?? {};
  if (typeof sender !== 'string' || sender !== pay.data?.from || !Number.isInteger(parts) || !Array.isArray(copies)) return actions;
  if ((parts as number) * SPONSOR_PART_UNITS > remainingUnits) return actions;
  return [{ account: CRYPT_ROUTER_ACCOUNT, name: 'sendfree', authorization: msg.authorization, data: { sender, parts, copies } }];
}

/** Recognises the contract's budget-reached / switched-off failures so the user can resend as paid. */
export const isSponsorRejection = (message: string | undefined) =>
  !!message && /free messaging (budget reached|is switched off)/i.test(message);
