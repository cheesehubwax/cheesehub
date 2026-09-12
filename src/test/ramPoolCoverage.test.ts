import { describe, expect, it } from 'vitest';
import {
  maxCheeseForPool,
  spendableWax,
  waxCostForCheese,
  type ResourcePricing,
} from '@/lib/airdropResources';

const pricing = (over: Partial<ResourcePricing['ram']> = {}): ResourcePricing => ({
  waxPerCheese: 1.93459804,
  priceSource: 'pool',
  ram: {
    enabled: true,
    minCheese: 1,
    maxCheese: 100,
    waxPerByte: 0.00002,
    feeBps: 375,
    historicalBytesPerCheese: null,
    liquidWax: 1_000,
    minLiquidReserve: 100,
    reserveBufferBps: 300,
    ...over,
  },
  powerup: null,
});

describe('spendableWax', () => {
  it('leaves the protected reserve and the safety buffer untouched', () => {
    // (1000 - 100) * (1 - 0.03)
    expect(spendableWax(pricing())).toBeCloseTo(873, 6);
  });

  it('is zero when the pool is at or below its reserve', () => {
    expect(spendableWax(pricing({ liquidWax: 100 }))).toBe(0);
    expect(spendableWax(pricing({ liquidWax: 40 }))).toBe(0);
  });

  it('handles a missing buffer setting', () => {
    expect(spendableWax(pricing({ reserveBufferBps: 0 }))).toBeCloseTo(900, 6);
  });
});

describe('waxCostForCheese', () => {
  it('converts a CHEESE spend to the WAX the pool releases', () => {
    expect(waxCostForCheese(100, pricing())).toBeCloseTo(193.459804, 6);
  });

  it('returns null for unusable inputs', () => {
    expect(waxCostForCheese(0, pricing())).toBeNull();
    expect(waxCostForCheese(10, { ...pricing(), waxPerCheese: 0 })).toBeNull();
  });
});

describe('maxCheeseForPool', () => {
  it('never suggests more than the pool can spend', () => {
    const p = pricing();
    const max = maxCheeseForPool(p)!;
    const cost = waxCostForCheese(max, p)!;
    expect(cost).toBeLessThanOrEqual(spendableWax(p));
  });

  it('is zero when nothing is spendable', () => {
    expect(maxCheeseForPool(pricing({ liquidWax: 100 }))).toBe(0);
  });

  it('is rounded down to CHEESE precision', () => {
    const max = maxCheeseForPool(pricing())!;
    expect(Number(max.toFixed(4))).toBe(max);
  });
});
