// Read-only monitor data for crypt.cheese and the cheesepowerz reward automation.
import { chainPost } from './chainRequest';
import { fetchTable } from './wax';
import { parseBudget, sponsorRemaining, type SponsorBudget } from './cryptSponsor';

export const CRYPT_CONTRACT = 'crypt.cheese';
export const POWERZ_ACCOUNT = 'cheesepowerz';
export const POWERZ_RESERVE_WAX = 400;
/** Claims are due 24h + 5m after the last claim. */
export const CLAIM_GAP_MS = (24 * 60 + 5) * 60 * 1000;
/** A claim later than this past its due time is flagged. */
export const CLAIM_OVERDUE_GRACE_MS = 2 * 60 * 60 * 1000;
/** CHEESE left on the router above this is flagged (router should hold nothing). */
export const CRYPT_DUST_CHEESE = 0.0001;
export const COMPOUND_PERMISSION = 'compound';
export const COMPOUND_LINKED_ACTIONS = ['claimgbmvote', 'delegatebw'] as const;

export interface CryptConfig {
  part_fee: string;
  recipient_fee: string;
  null_percent: number;
  max_recipients: number;
  max_parts: number;
  paused: boolean;
}

/** Contract defaults used when setconfig has never been run. */
export const CRYPT_DEFAULT_CONFIG: CryptConfig = {
  part_fee: '0.0100 CHEESE',
  recipient_fee: '0.0001 CHEESE',
  null_percent: 80,
  max_recipients: 49,
  max_parts: 35,
  paused: false,
};

export interface CryptStatus {
  config: CryptConfig;
  usingDefaults: boolean;
  pendingCount: number;
  cheeseBalance: number | null;
  /** Free-message budget row; null before the sponsored version is deployed / setbudget is run. */
  budget: SponsorBudget | null;
}

export interface PowerzAutomation {
  liquidWax: number | null;
  cpuStakedWax: number | null;
  lastClaim: Date | null;
  compoundPermission: boolean;
  linkedActions: string[];
}

function amount(asset: string | undefined | null): number | null {
  if (!asset) return null;
  const n = parseFloat(asset);
  return Number.isFinite(n) ? n : null;
}

async function cheeseBalance(account: string): Promise<number | null> {
  const rows = await fetchTable<{ balance: string }>('cheeseburger', account, 'accounts', { limit: 10 });
  const row = rows.find(r => r.balance.endsWith(' CHEESE'));
  return row ? amount(row.balance) : 0;
}

export async function fetchCryptStatus(): Promise<CryptStatus> {
  const [cfgRows, pending, balance, budgetRows] = await Promise.all([
    fetchTable<CryptConfig>(CRYPT_CONTRACT, CRYPT_CONTRACT, 'config', { limit: 1 }),
    fetchTable<unknown>(CRYPT_CONTRACT, CRYPT_CONTRACT, 'pending', { limit: 100 }),
    cheeseBalance(CRYPT_CONTRACT).catch(() => null),
    fetchTable<unknown>(CRYPT_CONTRACT, CRYPT_CONTRACT, 'budget', { limit: 1 }).catch(() => []),
  ]);
  return {
    config: cfgRows[0] ?? CRYPT_DEFAULT_CONFIG,
    usingDefaults: cfgRows.length === 0,
    pendingCount: pending.length,
    cheeseBalance: balance,
    budget: parseBudget(budgetRows[0]),
  };
}

interface AccountResp {
  core_liquid_balance?: string;
  self_delegated_bandwidth?: { cpu_weight?: string } | null;
  voter_info?: { last_claim_time?: string } | null;
  permissions?: { perm_name: string; linked_actions?: { account: string; action?: string }[] }[];
}

export async function fetchPowerzAutomation(): Promise<PowerzAutomation> {
  const acct = await chainPost<AccountResp>('/v1/chain/get_account', { account_name: POWERZ_ACCOUNT });
  const perm = acct.permissions?.find(p => p.perm_name === COMPOUND_PERMISSION);
  let lastClaimRaw = acct.voter_info?.last_claim_time;
  if (!lastClaimRaw) {
    const voters = await fetchTable<{ last_claim_time?: string }>('eosio', 'eosio', 'voters', {
      lower_bound: POWERZ_ACCOUNT, upper_bound: POWERZ_ACCOUNT, limit: 1,
    }).catch(() => []);
    lastClaimRaw = voters[0]?.last_claim_time;
  }
  const lastClaim = lastClaimRaw ? new Date(lastClaimRaw.endsWith('Z') ? lastClaimRaw : `${lastClaimRaw}Z`) : null;
  return {
    liquidWax: amount(acct.core_liquid_balance),
    cpuStakedWax: amount(acct.self_delegated_bandwidth?.cpu_weight),
    lastClaim: lastClaim && !isNaN(lastClaim.getTime()) && lastClaim.getTime() > 0 ? lastClaim : null,
    compoundPermission: !!perm,
    linkedActions: (perm?.linked_actions ?? [])
      .filter(l => l.account === 'eosio' && l.action)
      .map(l => l.action as string),
  };
}

// ── Warning rules (pure, tested) ──

export function cryptPendingWarn(s: Pick<CryptStatus, 'pendingCount'>): boolean {
  return s.pendingCount > 0;
}

/** Flags CHEESE on the router beyond the operator's sponsor balance (user funds must never stay there). */
export function cryptBalanceWarn(balance: number | null, sponsorBalanceUnits = 0): boolean {
  return balance != null && balance - sponsorBalanceUnits / 10000 > CRYPT_DUST_CHEESE + 1e-9;
}

/** Sponsor funds low: less than two full days of the daily limit left (only while free messaging is on). */
export function cryptSponsorLowWarn(b: SponsorBudget | null): boolean {
  return !!b && b.enabled && b.sponsorBalance < b.dailyLimit * 2;
}

/** Today's free-message usage (units) and what is still available now. */
export function cryptSponsorToday(b: SponsorBudget | null, nowSec = Math.floor(Date.now() / 1000)) {
  if (!b) return null;
  const remaining = sponsorRemaining(b, nowSec);
  const fresh = b.windowStart === 0 || nowSec - b.windowStart >= 86400;
  return { spent: fresh ? 0 : b.spent, limit: b.dailyLimit, remaining, resetsAt: fresh ? null : new Date((b.windowStart + 86400) * 1000) };
}

export function powerzReserveWarn(liquidWax: number | null): boolean {
  return liquidWax != null && liquidWax > POWERZ_RESERVE_WAX;
}

export function nextClaimAt(lastClaim: Date | null): Date | null {
  return lastClaim ? new Date(lastClaim.getTime() + CLAIM_GAP_MS) : null;
}

export function claimOverdue(lastClaim: Date | null, now: Date): boolean {
  const next = nextClaimAt(lastClaim);
  return next != null && now.getTime() > next.getTime() + CLAIM_OVERDUE_GRACE_MS;
}

export function missingCompoundLinks(a: Pick<PowerzAutomation, 'compoundPermission' | 'linkedActions'>): string[] {
  if (!a.compoundPermission) return [...COMPOUND_LINKED_ACTIONS];
  return COMPOUND_LINKED_ACTIONS.filter(x => !a.linkedActions.includes(x));
}
