import { describe, expect, it } from 'vitest';
import {
  AvailableBalance,
  CompoundCandidate,
  balanceKey,
  planCompound,
} from '@/lib/alcorCompound';

const CHEESE = { contract: 'cheeseburger', symbol: 'CHEESE' };
const USDC = { contract: 'eth.token', symbol: 'WAXUSDC' };

function candidate(overrides: Partial<CompoundCandidate> = {}): CompoundCandidate {
  return {
    positionId: 1,
    poolId: 10,
    tickLower: -100,
    tickUpper: 100,
    tokenA: { ...CHEESE, amount: 1000 },
    tokenB: { ...USDC, amount: 100 },
    usdValue: 500,
    rewardTokenKeys: [balanceKey(CHEESE.contract, CHEESE.symbol), balanceKey(USDC.contract, USDC.symbol)],
    ...overrides,
  };
}

function balances(entries: Array<[string, AvailableBalance]>) {
  return new Map<string, AvailableBalance>(entries);
}

describe('planCompound', () => {
  it('pairs the smaller side in full and matches the larger side', () => {
    const plan = planCompound(
      [candidate()],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 500, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 10, precision: 6 }],
      ]),
    );

    expect(plan.skipped).toHaveLength(0);
    expect(plan.compoundable).toHaveLength(1);
    // ratio = 0.1 → 10 WAXUSDC pairs with 100 CHEESE
    expect(plan.compoundable[0].tokenA.amount).toBeCloseTo(100, 6);
    expect(plan.compoundable[0].tokenB.amount).toBeCloseTo(10, 6);
    expect(plan.compoundable[0].tokenA.quantity).toBe('100.00000000 CHEESE');
    expect(plan.compoundable[0].tokenB.quantity).toBe('10.000000 WAXUSDC');
  });

  it('skips positions whose rewards cover only one side', () => {
    const plan = planCompound(
      [candidate({ rewardTokenKeys: [balanceKey(CHEESE.contract, CHEESE.symbol)] })],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 500, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 10, precision: 6 }],
      ]),
    );

    expect(plan.compoundable).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('rewards-one-sided');
    expect(plan.skipped[0].detail).toContain('WAXUSDC');
  });

  it('skips dust that rounds to zero at token precision', () => {
    const plan = planCompound(
      [candidate()],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 0.000001, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 0.0000001, precision: 6 }],
      ]),
    );

    expect(plan.compoundable).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('dust');
  });

  it('skips positions with missing tick data', () => {
    const plan = planCompound(
      [candidate({ tickLower: 0, tickUpper: 0 })],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 500, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 10, precision: 6 }],
      ]),
    );

    expect(plan.compoundable).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('missing-ticks');
  });

  it('never allocates more of a shared reward token than was claimed', () => {
    const plan = planCompound(
      [
        candidate({ positionId: 1, usdValue: 900 }),
        candidate({ positionId: 2, usdValue: 100 }),
      ],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 150, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 12, precision: 6 }],
      ]),
    );

    const totalCheese = plan.compoundable.reduce((sum, e) => sum + e.tokenA.amount, 0);
    const totalUsdc = plan.compoundable.reduce((sum, e) => sum + e.tokenB.amount, 0);
    expect(totalCheese).toBeLessThanOrEqual(150);
    expect(totalUsdc).toBeLessThanOrEqual(12);
    // Highest-value position is served first.
    expect(plan.compoundable[0].positionId).toBe(1);
  });

  it('caps the number of compounded positions per click', () => {
    const many = Array.from({ length: 22 }, (_, i) =>
      candidate({ positionId: i + 1, poolId: i + 1, usdValue: 1000 - i }),
    );
    const plan = planCompound(
      many,
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 100000, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 10000, precision: 6 }],
      ]),
    );

    expect(plan.compoundable).toHaveLength(20);
    expect(plan.skipped.filter(s => s.reason === 'position-cap')).toHaveLength(2);
  });
});
