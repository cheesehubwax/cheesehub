import { describe, expect, it } from 'vitest';
import {
  AvailableBalance,
  COMPOUND_FEE_RATE,
  CompoundCandidate,
  balanceKey,
  buildBalanceReadList,
  buildClaimedBalances,
  buildCompoundFeeTotals,
  paysBothTokens,
  planCompound,
} from '@/lib/alcorCompound';
import { PoolSlot, poolDepositRatio, sqrtPriceAtTick } from '@/lib/alcorV3Amounts';

const CHEESE = { contract: 'cheeseburger', symbol: 'CHEESE' };
const USDC = { contract: 'eth.token', symbol: 'WAXUSDC' };

/**
 * Build a pool slot whose in-range deposit ratio (token B per token A, in
 * display units) matches the target, by searching for the sqrt price.
 */
function slotForRatio(
  target: number,
  tickLower = -100,
  tickUpper = 100,
  precisionA = 8,
  precisionB = 6,
): PoolSlot {
  const sqrtL = sqrtPriceAtTick(tickLower);
  const sqrtU = sqrtPriceAtTick(tickUpper);
  let lo = sqrtL;
  let hi = sqrtU;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const slot: PoolSlot = { sqrtPriceX64: String(BigInt(Math.round(mid * 2 ** 32)) * (2n ** 32n)), tick: 0 };
    const { ratio } = poolDepositRatio(slot, tickLower, tickUpper, precisionA, precisionB);
    if (ratio === null) break;
    if (ratio < target) lo = mid;
    else hi = mid;
  }
  const mid = (lo + hi) / 2;
  return { sqrtPriceX64: String(BigInt(Math.round(mid * 2 ** 32)) * (2n ** 32n)), tick: 0 };
}

const DEFAULT_SLOT = slotForRatio(0.1);

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
    slot: DEFAULT_SLOT,
    ...overrides,
  };
}

function balances(entries: Array<[string, AvailableBalance]>) {
  return new Map<string, AvailableBalance>(entries);
}

describe('planCompound', () => {
  it('pairs the smaller side in full and takes the 0.75% fee, using the whole claimed amount', () => {
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
    // All 10 claimed WAXUSDC goes in → ratio 0.1 → 100 CHEESE gross
    expect(entry.tokenA.gross).toBeCloseTo(100, 6);
    expect(entry.tokenB.gross).toBeCloseTo(10, 4);
    expect(entry.tokenA.fee).toBeCloseTo(entry.tokenA.gross * COMPOUND_FEE_RATE, 6);
    expect(entry.tokenB.fee).toBeCloseTo(entry.tokenB.gross * COMPOUND_FEE_RATE, 5);
    expect(entry.tokenA.amount).toBeCloseTo(entry.tokenA.gross - entry.tokenA.fee, 6);
    expect(entry.tokenB.amount).toBeCloseTo(entry.tokenB.gross - entry.tokenB.fee, 6);
    // Deposit plus fee never exceeds what was claimed.
    expect(entry.tokenA.amount + entry.tokenA.fee).toBeLessThanOrEqual(500);
    expect(entry.tokenB.amount + entry.tokenB.fee).toBeLessThanOrEqual(10);
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
      // Pool ratio so lopsided that the matched side rounds away entirely.
      [candidate({ slot: slotForRatio(1e-6, -100, 100, 8, 2) })],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 1, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 1, precision: 2 }],
      ]),
    );

    expect(plan.compoundable).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('dust');
  });

  it('skips a position whose range no longer covers the pool price', () => {
    const plan = planCompound(
      [candidate({ slot: { ...DEFAULT_SLOT, tick: 200 } })],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 500, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 10, precision: 6 }],
      ]),
    );

    expect(plan.compoundable).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('out-of-range');
  });

  it('skips a position when the pool price could not be read', () => {
    const plan = planCompound(
      [candidate({ slot: null })],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 500, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 10, precision: 6 }],
      ]),
    );

    expect(plan.compoundable).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('pool-price-unknown');
  });

  it('sizes the deposit at the pool ratio, not the amounts already in the position', () => {
    const plan = planCompound(
      // Position holdings imply 1:1, the pool slot says 0.1 — the pool wins.
      [candidate({ tokenA: { ...CHEESE, amount: 100 }, tokenB: { ...USDC, amount: 100 } })],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 500, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 10, precision: 6 }],
      ]),
    );

    const entry = plan.compoundable[0];
    expect(entry.tokenB.amount / entry.tokenA.amount).toBeCloseTo(0.1, 4);
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

describe('buildClaimedBalances', () => {
  const cheeseKey = balanceKey(CHEESE.contract, CHEESE.symbol);
  const usdcKey = balanceKey(USDC.contract, USDC.symbol);

  it('only exposes the amount the claim added, never pre-existing holdings', () => {
    const claimed = buildClaimedBalances(
      balances([
        [cheeseKey, { balance: 4000, precision: 8 }],
        [usdcKey, { balance: 25, precision: 6 }],
      ]),
      balances([
        [cheeseKey, { balance: 4100, precision: 8 }],
        [usdcKey, { balance: 35, precision: 6 }],
      ]),
    );

    expect(claimed.get(cheeseKey)).toMatchObject({ balance: 100, known: true });
    expect(claimed.get(usdcKey)).toMatchObject({ balance: 10, known: true });
  });

  it('spends none of a wallet holding when the claim paid nothing', () => {
    const claimed = buildClaimedBalances(
      balances([[cheeseKey, { balance: 4000, precision: 8 }]]),
      balances([[cheeseKey, { balance: 4000, precision: 8 }]]),
    );
    expect(claimed.get(cheeseKey)?.balance).toBe(0);

    const plan = planCompound([candidate()], claimed);
    expect(plan.compoundable).toHaveLength(0);
  });

  it('marks a token unknown when either read failed or no baseline exists', () => {
    const failedAfter = buildClaimedBalances(
      balances([[cheeseKey, { balance: 10, precision: 8 }]]),
      balances([[cheeseKey, { balance: 0, precision: 8, known: false }]]),
    );
    expect(failedAfter.get(cheeseKey)?.known).toBe(false);

    const noBaseline = buildClaimedBalances(
      balances([]),
      balances([[cheeseKey, { balance: 500, precision: 8 }]]),
    );
    expect(noBaseline.get(cheeseKey)).toMatchObject({ balance: 0, known: false });
  });

  it('skips a position honestly when its claim delta could not be measured', () => {
    const claimed = buildClaimedBalances(
      balances([[usdcKey, { balance: 5, precision: 6 }]]),
      balances([
        [cheeseKey, { balance: 500, precision: 8 }],
        [usdcKey, { balance: 15, precision: 6 }],
      ]),
    );

    const plan = planCompound([candidate()], claimed);
    expect(plan.compoundable).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('balance-unknown');
    expect(plan.skipped[0].detail).toContain('CHEESE');
  });
});


describe('poolDepositRatio', () => {
  it('matches the ratio implied by the pool reserves for a full-range position', () => {
    // Alcor pool 1252 (CHEESE/WAX): tick 96521, reserves 155119.3603 CHEESE (4dp)
    // and 241246.46467914 WAX (8dp) → roughly 1.555 WAX per CHEESE.
    const slot = { sqrtPriceX64: '2300109684333533264855', tick: 96521 };
    const { state, ratio } = poolDepositRatio(slot, 96521 - 6000, 96521 + 6000, 4, 8);
    expect(state).toBe('in-range');
    expect(ratio).not.toBeNull();
    expect(ratio as number).toBeGreaterThan(0.5);
    expect(ratio as number).toBeLessThan(5);
  });

  it('reports positions below and above their range', () => {
    const slot = { sqrtPriceX64: '18446744073709551616', tick: 0 };
    expect(poolDepositRatio(slot, 100, 200, 8, 8).state).toBe('below-range');
    expect(poolDepositRatio(slot, -200, -100, 8, 8).state).toBe('above-range');
    expect(poolDepositRatio(slot, 100, 200, 8, 8).ratio).toBeNull();
  });
});
