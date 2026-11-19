// Pure WAX account-resource helpers shared by the CHEESEWallet screens.

/** eosio::refunds row, also returned inline by get_account as `refund_request`. */
export interface RefundRequest {
  owner: string;
  request_time: string;
  net_amount: string;
  cpu_amount: string;
}

export interface AccountResources {
  ram_quota: number;
  ram_usage: number;
  cpu_limit: { used: number; max: number };
  net_limit: { used: number; max: number };
  core_liquid_balance?: string;
  cpu_weight?: string;
  net_weight?: string;
  self_delegated_bandwidth?: { cpu_weight: string; net_weight: string };
  total_resources?: { cpu_weight: string; net_weight: string };
  refund_request?: RefundRequest | null;
  created?: string;
  creator?: string;
}

export const REFUND_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

export interface RefundStatus {
  /** Total WAX pending (cpu + net). */
  amount: number;
  /** True once the 3-day refund delay has elapsed. */
  available: boolean;
  /** Human-readable time remaining, e.g. "2d 4h" / "4h 12m". Empty when available. */
  timeLeft: string;
}

/**
 * Shared 3-day refund maturity calculation. Used by both the account summary
 * and the Stake manager's Refund tab so the two views can never disagree.
 */
export function getRefundStatus(
  refund: RefundRequest | null | undefined,
  now: number = Date.now()
): RefundStatus | null {
  if (!refund) return null;
  const cpu = parseFloat(refund.cpu_amount?.split(' ')[0] || '0') || 0;
  const net = parseFloat(refund.net_amount?.split(' ')[0] || '0') || 0;
  const amount = cpu + net;
  if (amount <= 0) return null;

  const raw = refund.request_time || '';
  const requestTime = new Date(raw.endsWith('Z') ? raw : `${raw}Z`).getTime();
  const readyAt = requestTime + REFUND_DELAY_MS;

  if (!Number.isFinite(requestTime)) return { amount, available: true, timeLeft: '' };
  if (now >= readyAt) return { amount, available: true, timeLeft: '' };

  const remaining = readyAt - now;
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const timeLeft = days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
  return { amount, available: false, timeLeft };
}


export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatCpu(us: number): string {
  if (us < 1000) return `${us} µs`;
  if (us < 1000000) return `${(us / 1000).toFixed(2)} ms`;
  return `${(us / 1000000).toFixed(2)} s`;
}

export function parseWaxBalance(balance: string | undefined): number {
  if (!balance) return 0;
  return parseFloat(balance.replace(' WAX', '')) || 0;
}

export function parseStakedWeight(weight: string | number | undefined): number {
  if (!weight) return 0;
  if (typeof weight === 'string') {
    if (weight.includes(' WAX')) return parseFloat(weight.replace(' WAX', ''));
    return Number(weight) / 100000000;
  }
  return Number(weight) / 100000000;
}

/** WAX account names: 1–12 chars of a–z, 1–5 and dots. */
export function isValidWaxAccount(account: string): boolean {
  if (!account || account.length < 1 || account.length > 12) return false;
  return /^[a-z1-5.]+$/.test(account);
}
