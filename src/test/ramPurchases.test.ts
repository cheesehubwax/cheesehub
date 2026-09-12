import { describe, expect, it } from 'vitest';
import { planRamPurchases, sliceRamUnits, type AirdropRecipient } from '@/lib/airdrop';

// ram.chz limits in CHEESE units (4 dp): 1.0000 min, 100.0000 max.
const MIN = 10_000n;
const MAX = 1_000_000n;

const r = (account: string, units: bigint): AirdropRecipient => ({
  account,
  units,
  weight: 1,
});

describe('sliceRamUnits', () => {
  it('keeps a share at or below the maximum as one purchase', () => {
    expect(sliceRamUnits(MAX, MIN, MAX)).toEqual([MAX]);
    expect(sliceRamUnits(500_000n, MIN, MAX)).toEqual([500_000n]);
  });

  it('splits a share just over the maximum into two even purchases', () => {
    const slices = sliceRamUnits(MAX + 1n, MIN, MAX);
    expect(slices).toHaveLength(2);
    expect(slices.reduce((s, x) => s + x, 0n)).toBe(MAX + 1n);
    for (const s of slices) {
      expect(s).toBeLessThanOrEqual(MAX);
      expect(s).toBeGreaterThanOrEqual(MIN);
    }
  });

  it('never leaves a trailing purchase below the minimum', () => {
    // Greedy slicing would leave 0.0001 CHEESE behind here.
    const units = MAX * 2n + 1n;
    const slices = sliceRamUnits(units, MIN, MAX);
    expect(slices).toHaveLength(3);
    expect(slices.reduce((s, x) => s + x, 0n)).toBe(units);
    for (const s of slices) expect(s).toBeGreaterThanOrEqual(MIN);
  });
});

describe('planRamPurchases', () => {
  it('skips shares below the minimum and splits shares above the maximum', () => {
    const plan = planRamPurchases(
      [r('tiny', 5_000n), r('mid', 500_000n), r('whale', 1_300_000n)],
      MIN,
      MAX,
    );
    expect(plan.belowMin.map((x) => x.account)).toEqual(['tiny']);
    expect(plan.included.map((x) => x.account)).toEqual(['mid', 'whale']);
    expect(plan.splitCount).toBe(1);
    expect(plan.purchaseCounts.get('whale')).toBe(2);
    expect(plan.purchases).toHaveLength(3);
    const whaleTotal = plan.purchases
      .filter((p) => p.account === 'whale')
      .reduce((s, p) => s + p.units, 0n);
    expect(whaleTotal).toBe(1_300_000n);
  });
});
