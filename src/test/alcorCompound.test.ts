import { describe, expect, it } from 'vitest';
import {
  AvailableBalance,
  COMPOUND_BUFFER_RATE,
  COMPOUND_FEE_RATE,
  CompoundCandidate,
  balanceKey,
  buildBalanceReadList,
  buildCompoundFeeTotals,
  paysBothTokens,
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
  it('pairs the smaller side in full, withholds the buffer and takes the 0.75% fee', () => {
    const plan = planCompound(
      [candidate()],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 500, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 10, precision: 6 }],
      ]),
    );

    expect(plan.skipped).toHaveLength(0);
    expect(plan.compoundable).toHaveLength(1);
    const entry = plan.compoundable[0];
    // 0.5% buffer: 9.95 WAXUSDC usable → ratio 0.1 → 99.5 CHEESE gross
    expect(entry.tokenA.gross).toBeCloseTo(99.5, 6);
    expect(entry.tokenB.gross).toBeCloseTo(9.95, 4);
    expect(entry.tokenA.fee).toBeCloseTo(entry.tokenA.gross * COMPOUND_FEE_RATE, 6);
    expect(entry.tokenB.fee).toBeCloseTo(entry.tokenB.gross * COMPOUND_FEE_RATE, 5);
    expect(entry.tokenA.amount).toBeCloseTo(entry.tokenA.gross - entry.tokenA.fee, 6);
    expect(entry.tokenB.amount).toBeCloseTo(entry.tokenB.gross - entry.tokenB.fee, 6);
    // Deposit plus fee never exceeds the buffered balance.
    expect(entry.tokenA.amount + entry.tokenA.fee).toBeLessThanOrEqual(500 * (1 - COMPOUND_BUFFER_RATE));
    expect(entry.tokenB.amount + entry.tokenB.fee).toBeLessThanOrEqual(10 * (1 - COMPOUND_BUFFER_RATE));
    expect(entry.tokenA.quantity).toBe(`${entry.tokenA.amount.toFixed(8)} CHEESE`);
    expect(entry.tokenB.feeQuantity).toBe(`${entry.tokenB.fee.toFixed(6)} WAXUSDC`);
  });

  it('omits a fee that rounds to zero but still deposits', () => {
    const plan = planCompound(
      [candidate()],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 5, precision: 2 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 0.02, precision: 2 }],
      ]),
    );

    expect(plan.compoundable).toHaveLength(1);
    const entry = plan.compoundable[0];
    expect(entry.tokenB.fee).toBe(0);
    expect(entry.tokenB.amount).toBeGreaterThan(0);
    expect(buildCompoundFeeTotals(plan.compoundable).some(f => f.symbol === 'WAXUSDC')).toBe(false);
  });

  it('aggregates fees per token across positions', () => {
    const plan = planCompound(
      [
        candidate({ positionId: 1, usdValue: 900 }),
        candidate({ positionId: 2, poolId: 11, usdValue: 100 }),
      ],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 150, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 12, precision: 6 }],
      ]),
    );

    const totals = buildCompoundFeeTotals(plan.compoundable);
    expect(totals).toHaveLength(2);
    const cheeseFee = totals.find(t => t.symbol === 'CHEESE')!;
    const expected = plan.compoundable.reduce((sum, e) => sum + e.tokenA.fee, 0);
    expect(cheeseFee.amount).toBeCloseTo(expected, 6);
    expect(cheeseFee.contract).toBe(CHEESE.contract);
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
      // Ratio so lopsided that the matched side rounds away entirely.
      [candidate({ tokenA: { ...CHEESE, amount: 1_000_000 }, tokenB: { ...USDC, amount: 1 } })],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 1, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 1, precision: 2 }],
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
    // Distinct token pair per position so balances never limit the count.
    const many = Array.from({ length: 22 }, (_, i) =>
      candidate({
        positionId: i + 1,
        poolId: i + 1,
        usdValue: 1000 - i,
        tokenA: { contract: `tok${i}.a`, symbol: `AAA${i}`, amount: 1000 },
        tokenB: { contract: `tok${i}.b`, symbol: `BBB${i}`, amount: 100 },
        rewardTokenKeys: [balanceKey(`tok${i}.a`, `AAA${i}`), balanceKey(`tok${i}.b`, `BBB${i}`)],
      }),
    );
    const plan = planCompound(
      many,
      balances(
        many.flatMap((c) => [
          [balanceKey(c.tokenA.contract, c.tokenA.symbol), { balance: 500, precision: 8 }] as [string, AvailableBalance],
          [balanceKey(c.tokenB.contract, c.tokenB.symbol), { balance: 10, precision: 6 }] as [string, AvailableBalance],
        ]),
      ),
    );

    expect(plan.compoundable).toHaveLength(20);
    expect(plan.skipped.filter(s => s.reason === 'position-cap')).toHaveLength(2);
  });

});

describe('token matching normalisation', () => {
  it('matches reward tokens across casing and missing contracts', () => {
    const rewards = ['cheeseburger:CHEESE', 'eosio.token:WAX'];
    expect(paysBothTokens(rewards, { contract: 'cheeseburger', symbol: 'cheese' }, { contract: '', symbol: 'WAX' })).toBe(true);
    expect(paysBothTokens(rewards, { contract: '', symbol: 'HOLE' }, { contract: '', symbol: 'WAX' })).toBe(false);
  });

  it('finds claimed balances by symbol when the pool token lacks a contract', () => {
    const candidates = [candidate({
      tokenA: { contract: '', symbol: 'CHEESE', amount: 100 },
      tokenB: { contract: '', symbol: 'WAX', amount: 200 },
      rewardTokenKeys: ['cheeseburger:CHEESE', 'eosio.token:WAX'],
    })];
    const available = new Map([
      ['cheeseburger:CHEESE', { balance: 10, precision: 8 }],
      ['eosio.token:WAX', { balance: 20, precision: 8 }],
    ]);
    const plan = planCompound(candidates, available);
    expect(plan.compoundable).toHaveLength(1);
    expect(plan.skipped).toHaveLength(0);
  });
});

describe('unreadable balances', () => {
  it('reports a balance that could not be read instead of claiming none is left', () => {
    const plan = planCompound(
      [candidate()],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 0, precision: 8, known: false }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 10, precision: 6, known: true }],
      ]),
    );

    expect(plan.compoundable).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('balance-unknown');
    expect(plan.skipped[0].detail).toContain('CHEESE');
    expect(plan.skipped[0].detail).not.toContain('No claimed balance left');
  });

  it('treats a missing balance entry as unreadable', () => {
    const plan = planCompound([candidate()], balances([]));
    expect(plan.skipped[0].reason).toBe('balance-unknown');
  });

  it('distinguishes nothing claimed from used by a larger position', () => {
    const zero = planCompound(
      [candidate()],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 500, precision: 8, known: true }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 0, precision: 6, known: true }],
      ]),
    );
    expect(zero.skipped[0].reason).toBe('no-balance');
    expect(zero.skipped[0].detail).toBe('No WAXUSDC arrived from this claim.');

    const shared = planCompound(
      [
        candidate({ positionId: 1, usdValue: 900 }),
        candidate({ positionId: 2, usdValue: 100 }),
      ],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 1000, precision: 8, known: true }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 2, precision: 0, known: true }],
      ]),
    );
    const consumed = shared.skipped.find(s => s.positionId === 2);
    expect(consumed?.reason).toBe('no-balance');
    expect(consumed?.detail).toContain('used by a larger position');
  });
});

describe('buildBalanceReadList', () => {
  it('fills a missing reward contract from the pool token, then the registry', () => {
    const list = buildBalanceReadList([
      candidate({
        tokenA: { contract: 'cheeseburger', symbol: 'CHEESE', amount: 100 },
        tokenB: { contract: '', symbol: 'WAXUSDC', amount: 10 },
        rewardTokenKeys: [':CHEESE', ':WAXUSDC'],
      }),
    ]);

    const cheese = list.find(t => t.symbol.toUpperCase() === 'CHEESE');
    const usdc = list.find(t => t.symbol.toUpperCase() === 'WAXUSDC');
    expect(cheese?.contract).toBe('cheeseburger');
    // No contract anywhere in the position data — resolved from the registry.
    expect(usdc?.contract).toBe('eth.token');
  });

  it('does not duplicate a token shared by several positions', () => {
    const list = buildBalanceReadList([candidate({ positionId: 1 }), candidate({ positionId: 2 })]);
    expect(list).toHaveLength(2);
  });
});

