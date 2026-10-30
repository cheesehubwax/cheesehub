import { describe, expect, it } from 'vitest';
import { allocateAssets, chunk, computeAmounts, formatQuantity, parseUnits, planRamPurchases, sliceRamUnits, totalUnits } from '@/lib/airdrop';
import { planTotal, splitPurchases } from '@/lib/airdropResources';

const holders = [{ account: 'alice', weight: 3 }, { account: 'bob', weight: 2 }, { account: 'carol', weight: 1 }];

describe('CHEESEAir allocation safety', () => {
  it('conserves equal totals and awards indivisible remainder in stable holder order', () => {
    const result = computeAmounts(holders, 'equal', '1.0000', 4);
    expect(result.map(r => r.units)).toEqual([3334n, 3333n, 3333n]);
    expect(totalUnits(result)).toBe(10000n);
  });
  it('treats fixed amounts as per-recipient quantities', () => {
    const result = computeAmounts(holders, 'fixed', '0.0101', 4);
    expect(result.map(r => r.units)).toEqual([101n, 101n, 101n]);
    expect(totalUnits(result)).toBe(303n);
  });
  it('conserves prorata totals and drops zero-unit allocations', () => {
    expect(computeAmounts(holders, 'prorata', '0.0002', 4).map(r => [r.account, r.units])).toEqual([['alice', 1n], ['bob', 1n]]);
    for (const total of ['1', '100000000000000000.1234', '0.0001']) {
      expect(totalUnits(computeAmounts(holders, 'prorata', total, 4))).toBe(parseUnits(total, 4));
    }
  });
  it('rejects malformed, negative and over-precision amounts rather than rounding spend', () => {
    for (const text of ['-1', '1e3', 'NaN', '1.00001', '']) expect(() => parseUnits(text, 4)).toThrow();
    expect(formatQuantity(101n, 4, 'CHEESE')).toBe('0.0101 CHEESE');
  });
  it('assigns NFTs only once, in inventory order, and conserves capped totals', () => {
    const pool = ['1', '2', '3', '4', '5'];
    const result = allocateAssets(pool, holders, 'equal', '9');
    expect(result.assignments.map(a => a.assetIds)).toEqual([['1', '2'], ['3', '4'], ['5']]);
    expect(result.assigned).toBe(5);
    expect(result.leftover).toBe(0);
    expect(result.capped).toBe(true);
    expect(new Set(result.assignments.flatMap(a => a.assetIds)).size).toBe(5);
  });
  it('reports NFT fixed-mode shortfall without inventing assets', () => {
    const result = allocateAssets(['1', '2', '3'], holders, 'fixed', '2');
    expect(result.shortfall).toBe(3);
    expect(result.assignments).toEqual([{ account: 'alice', assetIds: ['1', '2'] }]);
    expect(result.leftover).toBe(1);
  });
  it('conserves RAM shares while skipping below-minimum accounts', () => {
    const result = planRamPurchases([{ account: 'alice', weight: 1, units: 20001n }, { account: 'bob', weight: 1, units: 999n }], 1000n, 10000n);
    expect(result.purchases.map(p => p.units)).toEqual([6667n, 6667n, 6667n]);
    expect(result.belowMin.map(r => r.account)).toEqual(['bob']);
    expect(result.purchaseCounts.get('alice')).toBe(3);
    expect(result.purchases.reduce((s, p) => s + p.units, 0n)).toBe(20001n);
  });
  it('keeps legal RAM slice boundaries and exact totals', () => {
    for (const units of [10000n, 10001n, 19001n, 20001n]) {
      const slices = sliceRamUnits(units, 1000n, 10000n);
      expect(slices.every(u => u >= 1000n && u <= 10000n)).toBe(true);
      expect(slices.reduce((s, u) => s + u, 0n)).toBe(units);
    }
  });
  it('preserves resource purchase minimum and complete normal totals', () => {
    expect(splitPurchases(0.5, 1, 10)).toEqual([1]);
    expect(planTotal(splitPurchases(25, 1, 10))).toBe(25);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});