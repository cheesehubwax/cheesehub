import { fetchTable } from './wax';
import { logger } from './logger';

export const ESCROW_CONTRACT = 'waxdaoescrow';

export interface DripEscrow {
  ID: number;
  payer: string;
  receiver: string;
  payout_amount: string;
  token_contract: string;
  hours_between_payouts: number;
  end_time: number;
  last_claim: number;
  total_amount: string;
  total_amount_claimed: string;
  status: number;
}

export type DripStatus = 'awaiting_deposit' | 'active' | 'completed' | 'cancelled';

export function parseDripStatus(drip: DripEscrow): DripStatus {
  switch (drip.status) {
    case 0: return 'awaiting_deposit';
    case 1: return 'active';
    case 2: return 'completed';
    case 3: return 'cancelled';
    default: return 'active';
  }
}

export function getStatusLabel(status: DripStatus): string {
  switch (status) {
    case 'awaiting_deposit': return 'Awaiting Deposit';
    case 'active': return 'Active';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
  }
}

export function getStatusColor(status: DripStatus): string {
  switch (status) {
    case 'awaiting_deposit': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
}

/** Parse an asset string like "100.0000 CHEESE" into { amount, symbol, precision } */
export function parseAsset(asset: string | undefined | null): { amount: number; symbol: string; precision: number } {
  if (!asset || typeof asset !== 'string') return { amount: 0, symbol: '', precision: 0 };
  const parts = asset.split(' ');
  const amount = parseFloat(parts[0]) || 0;
  const symbol = parts[1] || '';
  const precision = parts[0].includes('.') ? parts[0].split('.')[1].length : 0;
  return { amount, symbol, precision };
}

/** Calculate how many claims are available */
export function getClaimableCount(drip: DripEscrow): number {
  const status = parseDripStatus(drip);
  if (status !== 'active') return 0;

  const now = Math.floor(Date.now() / 1000);
  const hoursSinceLastClaim = (now - drip.last_claim) / 3600;
  const claimable = Math.floor(hoursSinceLastClaim / drip.hours_between_payouts);

  // Cap by remaining amount
  const deposited = parseAsset(drip.total_amount);
  const claimed = parseAsset(drip.total_amount_claimed);
  const payout = parseAsset(drip.payout_amount);

  if (payout.amount <= 0) return 0;
  const maxRemainingClaims = Math.floor((deposited.amount - claimed.amount) / payout.amount);

  return Math.max(0, Math.min(claimable, maxRemainingClaims));
}

/** Get seconds until the next claim is available */
export function getTimeUntilNextClaim(drip: DripEscrow): number {
  const now = Math.floor(Date.now() / 1000);
  const nextClaimTime = drip.last_claim + (drip.hours_between_payouts * 3600);
  return Math.max(0, nextClaimTime - now);
}

/** Get drip progress as a percentage (0-100) */
export function getDripProgress(drip: DripEscrow): number {
  const deposited = parseAsset(drip.total_amount);
  const claimed = parseAsset(drip.total_amount_claimed);
  if (deposited.amount <= 0) return 0;
  return Math.min(100, (claimed.amount / deposited.amount) * 100);
}

/** Format hours into a human-readable string */
export function formatInterval(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours === 1) return '1h';
  if (hours < 24) return `${hours}h`;
  if (hours === 24) return '1 day';
  if (hours < 168) return `${Math.round(hours / 24)} days`;
  if (hours === 168) return '1 week';
  return `${Math.round(hours / 168)} weeks`;
}

/** Fetch all drips where user is payer or receiver */
export async function fetchUserDrips(account: string): Promise<{
  paying: DripEscrow[];
  receiving: DripEscrow[];
}> {
  try {
    const allDrips = await fetchTable<DripEscrow>(
      ESCROW_CONTRACT,
      ESCROW_CONTRACT,
      'drips',
      { limit: 1000 }
    );

    logger.info('Raw drips table data (first 3 rows):', allDrips.slice(0, 3));

    const paying = allDrips.filter(d => d.payer === account);
    const receiving = allDrips.filter(d => d.receiver === account);

    return { paying, receiving };
  } catch (error) {
    logger.error('Failed to fetch user drips:', error);
    return { paying: [], receiving: [] };
  }
}

/** Calculate total deposit needed for a new drip */
export function calculateTotalDeposit(
  payoutAmount: number,
  hoursPerPayment: number,
  endDate: Date
): { totalPayments: number; totalAmount: number } {
  const now = new Date();
  const hoursUntilEnd = (endDate.getTime() - now.getTime()) / (1000 * 3600);
  const totalPayments = Math.max(0, Math.floor(hoursUntilEnd / hoursPerPayment));
  const totalAmount = totalPayments * payoutAmount;
  return { totalPayments, totalAmount };
}
