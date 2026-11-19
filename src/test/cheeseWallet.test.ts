import { describe, expect, it } from 'vitest';
import {
  buildClaimRewardsAction,
  buildCreateIncentiveActions,
  buildStakeAction,
  buildUnstakeAction,
} from '@/lib/alcorFarms';
import { getAssetPrecision, parseAsset, slotFromPool } from '@/lib/alcor/parse';
import { formatRemainingDays, getIncentiveKey, isIncentiveExpired } from '@/lib/alcor/time';
import {
  REFUND_DELAY_MS,
  formatBytes,
  getRefundStatus,
  isValidWaxAccount,
  parseStakedWeight,
  parseWaxBalance,
} from '@/lib/walletResources';

const auth = [{ actor: 'alice.wam', permission: 'active' }];

describe('Alcor farm action builders', () => {
  it('claims one getreward per incentive/position', () => {
    expect(buildClaimRewardsAction('alice.wam', [{ incentiveId: 5, posId: 9 }, { incentiveId: 6, posId: 9 }])).toEqual([
      { account: 'swap.alcor', name: 'getreward', authorization: auth, data: { incentiveId: 5, posId: 9 } },
      { account: 'swap.alcor', name: 'getreward', authorization: auth, data: { incentiveId: 6, posId: 9 } },
    ]);
  });

  it('stakes and unstakes with owner, incentive and position', () => {
    const data = { owner: 'alice.wam', incentiveId: 5, posId: 9 };
    expect(buildStakeAction('alice.wam', 5, 9)).toEqual({ account: 'swap.alcor', name: 'stake', authorization: auth, data });
    expect(buildUnstakeAction('alice.wam', 5, 9)).toEqual({ account: 'swap.alcor', name: 'unstake', authorization: auth, data });
  });

  it('creates each incentive with a zero reward then funds it by memo', () => {
    const actions = buildCreateIncentiveActions('alice.wam', 12, 2592000, [
      { contract: 'cheeseburger', symbol: 'CHEESE', precision: 4, amount: 100 },
      { contract: 'eosio.token', symbol: 'WAX', precision: 8, amount: 1.5 },
    ], 40);
    expect(actions.map((a) => a.name)).toEqual(['newincentive', 'transfer', 'newincentive', 'transfer']);
    expect(actions[0].data).toEqual({ creator: 'alice.wam', poolId: 12, rewardToken: { contract: 'cheeseburger', quantity: '0.0000 CHEESE' }, duration: 2592000 });
    expect(actions[1]).toMatchObject({ account: 'cheeseburger', data: { from: 'alice.wam', to: 'swap.alcor', quantity: '100.0000 CHEESE', memo: 'incentreward#40' } });
    expect(actions[3]).toMatchObject({ account: 'eosio.token', data: { quantity: '1.50000000 WAX', memo: 'incentreward#41' } });
  });
});

describe('Alcor parsing', () => {
  it('reads amount, symbol and precision from asset strings', () => {
    expect(parseAsset('7.0782 CHEESE')).toEqual({ amount: 7.0782, symbol: 'CHEESE', precision: 4 });
    expect(parseAsset('')).toEqual({ amount: 0, symbol: '', precision: 0 });
    expect(getAssetPrecision('1.00000000 WAX')).toBe(8);
    expect(getAssetPrecision('')).toBe(8);
  });

  it('reads pool slots from both API and chain shapes, rejecting a zero price', () => {
    const api = slotFromPool({ sqrtPriceX64: '123', tick: -5, tokenA: { contract: 'a', symbol: 'A' }, tokenB: { contract: 'b', quantity: '1.0 B' } });
    expect(api).toEqual({ sqrtPriceX64: '123', tick: -5, tokenA: { contract: 'a', symbol: 'A' }, tokenB: { contract: 'b', symbol: 'B' } });
    expect(slotFromPool({ currSlot: { sqrtPriceX64: '77', tick: 3 } })?.tick).toBe(3);
    expect(slotFromPool({ sqrtPriceX64: '0', tick: 1 })).toBeNull();
  });
});

describe('Alcor incentive countdowns', () => {
  const now = 1_000_000;
  it('treats unknown end times as not expired', () => {
    expect(isIncentiveExpired(0, now)).toBe(false);
    expect(isIncentiveExpired(now, now)).toBe(true);
    expect(formatRemainingDays(0, now).label).toBe('—');
  });
  it('labels remaining time and urgency', () => {
    expect(formatRemainingDays(now - 1, now)).toEqual({ label: 'Ended', isUrgent: false, isExpired: true });
    expect(formatRemainingDays(now + 8 * 86400, now)).toEqual({ label: '8d', isUrgent: false, isExpired: false });
    expect(formatRemainingDays(now + 2 * 86400 + 3 * 3600, now)).toEqual({ label: '2d 3h', isUrgent: true, isExpired: false });
    expect(formatRemainingDays(now + 5 * 3600, now)).toEqual({ label: '5h', isUrgent: true, isExpired: false });
  });
  it('keys stakes by position and incentive', () => {
    expect(getIncentiveKey({ positionId: 9, incentiveId: 5 })).toBe('9-5');
  });
});

describe('wallet resource helpers', () => {
  it('matures refunds after three days', () => {
    const refund = { owner: 'a', request_time: '2026-01-01T00:00:00', cpu_amount: '1.00000000 WAX', net_amount: '0.50000000 WAX' };
    const start = Date.parse('2026-01-01T00:00:00Z');
    expect(getRefundStatus(refund, start + 3600_000)).toEqual({ amount: 1.5, available: false, timeLeft: '2d 23h' });
    expect(getRefundStatus(refund, start + REFUND_DELAY_MS)).toEqual({ amount: 1.5, available: true, timeLeft: '' });
    expect(getRefundStatus({ ...refund, cpu_amount: '0 WAX', net_amount: '0 WAX' })).toBeNull();
  });
  it('parses balances and staked weights', () => {
    expect(parseWaxBalance('12.5 WAX')).toBe(12.5);
    expect(parseWaxBalance(undefined)).toBe(0);
    expect(parseStakedWeight('3.25 WAX')).toBe(3.25);
    expect(parseStakedWeight(250000000)).toBe(2.5);
    expect(formatBytes(2048)).toBe('2.00 KB');
  });
  it('validates WAX account names', () => {
    expect(isValidWaxAccount('m23qs.wam')).toBe(true);
    expect(isValidWaxAccount('Bad')).toBe(false);
    expect(isValidWaxAccount('abcdefghijklm')).toBe(false);
    expect(isValidWaxAccount('acc6')).toBe(false);
  });
});
