import type { AlcorPool } from '@/lib/alcorFarms';

/** A reward token the creator is adding to a new Alcor farm. */
export interface RewardToken {
  id: string;
  contract: string;
  symbol: string;
  precision: number;
  amount: string;
  balance: number;
}

export interface DurationOption {
  label: string;
  days: number;
  seconds: number;
}

export const DURATION_OPTIONS: DurationOption[] = [
  { label: '1 Day', days: 1, seconds: 86400 },
  { label: '7 Days', days: 7, seconds: 604800 },
  { label: '30 Days', days: 30, seconds: 2592000 },
  { label: '60 Days', days: 60, seconds: 5184000 },
  { label: '90 Days', days: 90, seconds: 7776000 },
  { label: '180 Days', days: 180, seconds: 15552000 },
  { label: '240 Days', days: 240, seconds: 20736000 },
  { label: '360 Days', days: 360, seconds: 31104000 },
];

export const DEFAULT_DURATION = DURATION_OPTIONS[2];

/** Alcor pool fees are stored in hundredths of a basis point (3000 = 0.30%). */
export function formatFee(fee: number): string {
  return `${(fee / 10000).toFixed(2)}%`;
}

/** "Max" leaves a 0.01% margin so rounding never exceeds the wallet balance. */
export function maxRewardAmount(balance: number, precision: number): string {
  return (balance * 0.9999).toFixed(precision);
}

/** A farm can be created once a pool is picked and every reward amount is positive and affordable. */
export function isCreateFarmValid(selectedPool: AlcorPool | null, rewardTokens: RewardToken[]): boolean {
  if (!selectedPool) return false;
  if (rewardTokens.length === 0) return false;
  for (const rt of rewardTokens) {
    const amount = parseFloat(rt.amount);
    if (isNaN(amount) || amount <= 0) return false;
    if (amount > rt.balance) return false;
  }
  return true;
}
