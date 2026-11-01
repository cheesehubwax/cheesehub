import { describe, expect, test } from 'bun:test';
import { ACCOUNT, CLAIM_GAP_MS, claimDue, stakeExcess, stakeAction, validatePermission, waxAsset, waxUnits, type PermissionRow } from './policy';
import { maintain } from './service';

const voter = { owner: ACCOUNT, proxy: 'bigmikeproxy', producers: [], last_claim_time: '2026-10-30T10:50:43.500' };
const last = Date.parse('2026-10-30T10:50:43.500Z');

describe('user maintenance rules', () => {
  test('claims only after 24 hours plus five minutes', () => {
    expect(CLAIM_GAP_MS).toBe(86_700_000);
    expect(claimDue(voter, last + 86_699_999)).toBe(false);
    expect(claimDue(voter, last + 86_700_000)).toBe(true);
  });
  test('keeps exactly 400 WAX liquid; eight-decimal precision', () => {
    expect(stakeExcess('399.99999999 WAX')).toBe(0n);
    expect(stakeExcess('400.00000000 WAX')).toBe(0n);
    expect(stakeExcess('400.00000001 WAX')).toBe(1n);
    expect(waxAsset(stakeExcess('512.12345678 WAX'))).toBe('112.12345678 WAX');
    expect(() => waxUnits('400.0000 WAX')).toThrow();
  });
  test('stakes only into cheesepowerz CPU without transferring stake ownership', () => {
    expect(stakeAction(1n)).toEqual({ account: 'eosio', name: 'delegatebw', authorization: [{ actor: 'cheesepowerz', permission: 'compound' }],
      data: { from: 'cheesepowerz', receiver: 'cheesepowerz', stake_net_quantity: '0.00000000 WAX', stake_cpu_quantity: '0.00000001 WAX', transfer: false } });
  });
  test('restricted key cannot be reused as active or linked to transfer', () => {
    const row: PermissionRow = { perm_name: 'compound', parent: 'active', required_auth: { threshold: 1, keys: [{ key: 'dedicated', weight: 1 }], accounts: [], waits: [] },
      linked_actions: [{ account: 'eosio', action: 'claimgbmvote' }, { account: 'eosio', action: 'delegatebw' }] };
    expect(() => validatePermission([row], 'dedicated', x => x)).not.toThrow();
    expect(() => validatePermission([row, { ...row, perm_name: 'active' }], 'dedicated', x => x)).toThrow();
    expect(() => validatePermission([{ ...row, linked_actions: [...(row.linked_actions ?? []), { account: 'eosio.token', action: 'transfer' }] }], 'dedicated', x => x)).toThrow();
  });
});

test('claim settles before refreshing and staking the new balance', async () => {
  let claimed = false;
  const order: string[] = [];
  await maintain({ read: async () => ({ balance: claimed ? '430.12345678 WAX' : '390.00000000 WAX',
    voter: claimed ? { ...voter, last_claim_time: '2026-11-01T00:00:00' } : voter, now: Date.parse('2026-11-01T00:00:00Z') }),
    claim: async () => { order.push('claim'); claimed = true; },
    stake: async units => { order.push(waxAsset(units)); }, log: () => {} }, false);
  expect(order).toEqual(['claim', '30.12345678 WAX']);
});

test('dry run never signs even when both claim and stake are due', async () => {
  let signed = 0;
  await maintain({ read: async () => ({ balance: '900.00000000 WAX', voter, now: last + CLAIM_GAP_MS }),
    claim: async () => { signed++; }, stake: async () => { signed++; }, log: () => {} }, true);
  expect(signed).toBe(0);
});

test('unconfirmed claim stops before staking', async () => {
  let stakes = 0;
  await expect(maintain({ read: async () => ({ balance: '900.00000000 WAX', voter, now: last + CLAIM_GAP_MS }),
    claim: async () => { throw new Error('timeout'); }, stake: async () => { stakes++; }, log: () => {} }, false)).rejects.toThrow('timeout');
  expect(stakes).toBe(0);
});