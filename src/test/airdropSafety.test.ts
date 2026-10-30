import { describe, expect, it } from 'vitest';
import { allocateAssets, computeAmounts, sliceRamUnits, totalUnits } from '@/lib/airdrop';
import { splitPurchases, planTotal } from '@/lib/airdropResources';

describe('CHEESEAir payout safeguards', () => {
  it.each([NaN, Infinity, -Infinity, -1])('rejects invalid pro-rata weight %s for tokens and NFTs', weight => {
    const holders = [{ account: 'alice', weight }, { account: 'bob', weight: 1 }];
    expect(() => computeAmounts(holders, 'prorata', '10', 4)).toThrow();
    expect(() => allocateAssets(['1', '2'], holders, 'prorata', '2')).toThrow();
  });
  it('rejects all-zero pro-rata weights', () => {
    expect(() => computeAmounts([{ account: 'alice', weight: 0 }], 'prorata', '1', 4)).toThrow();
  });
  it('retains a positive small share that millionth normalization used to drop', () => {
    const result = computeAmounts([{ account: 'alice', weight: 1 }, { account: 'bob', weight: 0.0000001 }], 'prorata', '10000000', 0);
    expect(result.map(r => r.units)).toEqual([9999999n, 1n]);
    expect(totalUnits(result)).toBe(10000000n);
  });
  it('conserves totals when finite weights would overflow a number sum', () => {
    expect(computeAmounts([{ account: 'alice', weight: 1e308 }, { account: 'bob', weight: 1e308 }], 'prorata', '10', 0).map(r => r.units)).toEqual([5n, 5n]);
  });
  it('conserves fractional ratios exactly', () => {
    expect(computeAmounts([{ account: 'alice', weight: 0.1 }, { account: 'bob', weight: 0.2 }], 'prorata', '3', 0).map(r => r.units)).toEqual([1n, 2n]);
  });
  it('rejects a RAM share that cannot be split within both limits', () => {
    expect(() => sliceRamUnits(11n, 6n, 10n)).toThrow();
    expect(() => sliceRamUnits(10n, 11n, 10n)).toThrow();
  });
  it('never returns a silently truncated top-up plan', () => {
    expect(() => splitPurchases(501, 1, 10)).toThrow();
    expect(planTotal(splitPurchases(500, 1, 10))).toBe(500);
    expect(splitPurchases(500, 1, 10)).toHaveLength(50);
  });
  it('rejects invalid limits and impossible resource top-ups without overspending', () => {
    expect(() => splitPurchases(11, 6, 10)).toThrow();
    expect(() => splitPurchases(10, 11, 10)).toThrow();
    expect(() => splitPurchases(Infinity, 1, 10)).toThrow();
  });
  it('keeps an awkward resource tail within limits and conserves base units', () => {
    const plan = splitPurchases(20.0001, 1, 10);
    expect(plan.every(v => v >= 1 && v <= 10)).toBe(true);
    expect(plan.reduce((sum, v) => sum + BigInt(Math.round(v * 10000)), 0n)).toBe(200001n);
  });
});