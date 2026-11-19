import { describe, it, expect } from 'vitest';
import { DURATION_OPTIONS, DEFAULT_DURATION, formatFee, isCreateFarmValid, maxRewardAmount, type RewardToken } from '@/components/wallet/alcor/createFarm';
import { parseBalance, recordClaim, recentClaimFor, clearRecentClaim } from '@/components/wallet/alcor/compoundBalances';
import type { AlcorPool } from '@/lib/alcorFarms';

const pool = { id: 1 } as unknown as AlcorPool;
const rt = (amount: string, balance = 10): RewardToken => ({ id: 'a', contract: 'c', symbol: 'S', precision: 4, amount, balance });

describe('Create Alcor Farm helpers', () => {
  it('defaults to 30 days', () => {
    expect(DEFAULT_DURATION.seconds).toBe(2592000);
    expect(DURATION_OPTIONS).toHaveLength(8);
  });
  it('formats pool fee 3000 as 0.30%', () => expect(formatFee(3000)).toBe('0.30%'));
  it('max leaves a 0.01% margin', () => expect(maxRewardAmount(100, 4)).toBe('99.9900'));
  it('requires a pool, at least one token and affordable positive amounts', () => {
    expect(isCreateFarmValid(null, [rt('1')])).toBe(false);
    expect(isCreateFarmValid(pool, [])).toBe(false);
    expect(isCreateFarmValid(pool, [rt('0')])).toBe(false);
    expect(isCreateFarmValid(pool, [rt('11')])).toBe(false);
    expect(isCreateFarmValid(pool, [rt('10')])).toBe(true);
  });
});

describe('Compound All balance helpers', () => {
  it('parses precision from the balance string', () => {
    expect(parseBalance('1.2340 CHEESE')).toEqual({ balance: 1.234, precision: 4, known: true });
  });
  it('remembers a claim per account until cleared', () => {
    recordClaim('alice', 'tx', new Map());
    expect(recentClaimFor('alice')?.txId).toBe('tx');
    expect(recentClaimFor('bob')).toBeNull();
    clearRecentClaim();
    expect(recentClaimFor('alice')).toBeNull();
  });
});
