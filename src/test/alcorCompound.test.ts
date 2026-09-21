import { describe, expect, it } from 'vitest';
import {
  AvailableBalance,
  COMPOUND_FEE_RATE,
  COMPOUND_SLIPPAGE_TOLERANCE,
  CompoundCandidate,
  balanceKey,
  buildBalanceReadList,
  buildClaimedBalances,
  buildCompoundFeeTotals,
  isReversedAgainstPool,
  paysBothTokens,
  planCompound,
} from '@/lib/alcorCompound';
import { PoolSlot, poolDepositRatio, sqrtPriceAtTick } from '@/lib/alcorV3Amounts';
import { buildIncreaseLiquidityAction } from '@/lib/alcorFarms';

const CHEESE = { contract: 'cheeseburger', symbol: 'CHEESE' };
const USDC = { contract: 'eth.token', symbol: 'WAXUSDC' };

/** Encode a float sqrt price as a Q64.64 string. */
function sqrtPriceX64(x: number): string {
  const hi = Math.floor(x);
  const frac = x - hi;
  return (BigInt(hi) * 2n ** 64n + BigInt(Math.round(frac * 2 ** 64))).toString();
}

/**
 * Build a pool slot whose in-range deposit ratio (token B per token A, in
 * display units) equals the target. Solves the quadratic that comes from
 * rawB / rawA = (sqrtP - sqrtL) * sqrtP * sqrtU / (sqrtU - sqrtP).
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
  const r = target / Math.pow(10, precisionA - precisionB);
  const b = sqrtL * sqrtU - r;
  const x = (b + Math.sqrt(b * b + 4 * sqrtU * sqrtU * r)) / (2 * sqrtU);
  return { sqrtPriceX64: sqrtPriceX64(x), tick: 0 };
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
    // Both sides are re-aligned onto the pool ratio, so either may sit one unit
    // below gross minus fee — never above it.
    expect(entry.tokenA.amount).toBeLessThanOrEqual(entry.tokenA.gross - entry.tokenA.fee);
    expect(entry.tokenA.amount).toBeCloseTo(entry.tokenA.gross - entry.tokenA.fee, 4);
    expect(entry.tokenB.amount).toBeLessThanOrEqual(entry.tokenB.gross - entry.tokenB.fee);
    expect(entry.tokenB.amount).toBeCloseTo(entry.tokenB.gross - entry.tokenB.fee, 4);
    // Deposit plus fee never exceeds what was claimed.
    expect(entry.tokenA.amount + entry.tokenA.fee).toBeLessThanOrEqual(500);
    expect(entry.tokenB.amount + entry.tokenB.fee).toBeLessThanOrEqual(10);
    expect(entry.tokenA.quantity).toBe(`${entry.tokenA.amount.toFixed(8)} CHEESE`);
    expect(entry.tokenB.feeQuantity).toBe(`${entry.tokenB.fee.toFixed(6)} WAXUSDC`);
  });

  it('omits a fee that rounds to zero but still deposits', () => {
    const plan = planCompound(
      [candidate({ slot: slotForRatio(0.2, -100, 100, 2, 2) })],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 100, precision: 2 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 1, precision: 2 }],
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

describe('selected-position filtering', () => {
  it('fees are computed only from the positions the user kept selected', () => {
    const WAX = { contract: 'eosio.token', symbol: 'WAX' };
    const HOLE = { contract: 'hole.cheese', symbol: 'HOLE' };
    const plan = planCompound(
      [
        candidate({ positionId: 1, usdValue: 900 }),
        candidate({
          positionId: 2,
          poolId: 11,
          usdValue: 100,
          tokenA: { ...WAX, amount: 500 },
          tokenB: { ...HOLE, amount: 5000 },
          rewardTokenKeys: [balanceKey(WAX.contract, WAX.symbol), balanceKey(HOLE.contract, HOLE.symbol)],
        }),
      ],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 500, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 50, precision: 6 }],
        [balanceKey(WAX.contract, WAX.symbol), { balance: 50, precision: 8 }],
        [balanceKey(HOLE.contract, HOLE.symbol), { balance: 500, precision: 8 }],
      ]),
    );
    expect(plan.compoundable).toHaveLength(2);

    const deselected = new Set([2]);
    const selectedEntries = plan.compoundable.filter(e => !deselected.has(e.positionId));
    expect(selectedEntries.map(e => e.positionId)).toEqual([1]);

    const selectedTotals = buildCompoundFeeTotals(selectedEntries);
    // Position 2's tokens carry no fee at all once it is deselected.
    expect(selectedTotals.some(t => t.symbol === 'WAX')).toBe(false);
    expect(selectedTotals.some(t => t.symbol === 'HOLE')).toBe(false);
    const allTotals = buildCompoundFeeTotals(plan.compoundable);
    expect(allTotals.some(t => t.symbol === 'WAX')).toBe(true);
    expect(allTotals.some(t => t.symbol === 'HOLE')).toBe(true);
    // Each selected fee is exactly that entry's own fee, nothing more.
    selectedTotals.forEach(sel => {
      const expected = selectedEntries.reduce(
        (sum, e) => sum + (e.tokenA.symbol === sel.symbol ? e.tokenA.fee : e.tokenB.fee),
        0,
      );
      expect(sel.quantity).toBe(`${expected.toFixed(sel.precision)} ${sel.symbol}`);
    });
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
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 150, precision: 8, known: true }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 10, precision: 6, known: true }],
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

describe('pool token ordering', () => {
  it('inverts the ratio when the position reports the pair in the pool order reversed', () => {
    // Pool order is WAXUSDC/CHEESE while the position reports CHEESE/WAXUSDC.
    const slot: PoolSlot = {
      ...slotForRatio(0.1, -100, 100, 6, 8),
      tokenA: USDC,
      tokenB: CHEESE,
    };
    const c = candidate({ slot });

    expect(isReversedAgainstPool(c)).toBe(true);

    const plan = planCompound(
      [c],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 1000, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 1000, precision: 6 }],
      ]),
    );

    expect(plan.compoundable).toHaveLength(1);
    const entry = plan.compoundable[0];
    // Pool wants 0.1 CHEESE per WAXUSDC, so the position's B:A ratio is ~10.
    expect(entry.tokenB.gross / entry.tokenA.gross).toBeGreaterThan(5);
  });

  it('keeps the ratio as-is when the order already matches the pool', () => {
    const slot: PoolSlot = { ...DEFAULT_SLOT, tokenA: CHEESE, tokenB: USDC };
    const c = candidate({ slot });

    expect(isReversedAgainstPool(c)).toBe(false);

    const plan = planCompound(
      [c],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 1000, precision: 8 }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 1000, precision: 6 }],
      ]),
    );

    expect(plan.compoundable[0].tokenB.gross / plan.compoundable[0].tokenA.gross).toBeCloseTo(0.1, 3);
  });
});

describe('deposit minimums', () => {
  const minsFor = (tolerance?: number) => {
    const actions = buildIncreaseLiquidityAction(
      'alice',
      1,
      10,
      -100,
      100,
      CHEESE.contract,
      '100.00000000 CHEESE',
      USDC.contract,
      '10.000000 WAXUSDC',
      tolerance,
    );
    const add: any = actions[actions.length - 1];
    return { min: add.data, name: add.name };
  };

  it('defaults to the 0.5% tolerance Alcor itself uses', () => {
    const { min, name } = minsFor();
    expect(name).toBe('addliquid');
    expect(min.tokenAMin).toBe('99.50000000 CHEESE');
    expect(min.tokenBMin).toBe('9.950000 WAXUSDC');
  });

  it('applies the wider compound buffer so pool price movement does not reject the deposit', () => {
    const { min } = minsFor(COMPOUND_SLIPPAGE_TOLERANCE);
    expect(min.tokenAMin).toBe('97.00000000 CHEESE');
    expect(min.tokenBMin).toBe('9.700000 WAXUSDC');
    expect(min.tokenADesired).toBe('100.00000000 CHEESE');
  });

  it('floors the minimum instead of rounding it up above what the pool can use', () => {
    const actions = buildIncreaseLiquidityAction(
      'alice',
      1,
      10,
      -100,
      100,
      CHEESE.contract,
      '0.03 CHEESE',
      USDC.contract,
      '0.03 WAXUSDC',
      0.005,
    );
    const add: any = actions[actions.length - 1];
    // 0.03 * 0.995 = 0.02985 → floors to 0.02, never 0.03.
    expect(add.data.tokenAMin).toBe('0.02 CHEESE');
  });

  it('never demands more than one unit of precision short, so pool rounding alone cannot reject it', () => {
    const actions = buildIncreaseLiquidityAction(
      'alice',
      1,
      10,
      -100,
      100,
      CHEESE.contract,
      '1000.00000000 CHEESE',
      USDC.contract,
      '100.000000 WAXUSDC',
      0, // zero tolerance would otherwise demand the exact amount
    );
    const add: any = actions[actions.length - 1];
    expect(add.data.tokenAMin).toBe('999.99999999 CHEESE');
    expect(add.data.tokenBMin).toBe('99.999999 WAXUSDC');
  });
});

describe('minimum viable deposit', () => {
  it('skips a pair whose smaller side is only a few raw units', () => {
    // 22 raw units of an 8-decimal token — the size that Alcor rejected on chain.
    const c = candidate({
      positionId: 120690,
      tokenA: { ...CHEESE, amount: 2889.1986 },
      tokenB: { ...USDC, amount: 0.00029059 },
      slot: slotForRatio(0.0000001, -100, 100, 8, 8),
    });
    const plan = planCompound(
      [c],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 2.2874, precision: 8, known: true }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 0.00000023, precision: 8, known: true }],
      ]),
    );
    expect(plan.compoundable).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe('deposit-too-small');
    expect(plan.skipped[0].positionId).toBe(120690);
  });

  it('keeps token A exactly on the pool ratio of the rounded token B amount', () => {
    const ratio = 0.1;
    const c = candidate({ slot: slotForRatio(ratio, -100, 100, 8, 6) });
    const plan = planCompound(
      [c],
      balances([
        [balanceKey(CHEESE.contract, CHEESE.symbol), { balance: 12.34567891, precision: 8, known: true }],
        [balanceKey(USDC.contract, USDC.symbol), { balance: 5, precision: 6, known: true }],
      ]),
    );
    expect(plan.compoundable).toHaveLength(1);
    const entry = plan.compoundable[0];
    const a = parseFloat(entry.tokenA.quantity);
    const b = parseFloat(entry.tokenB.quantity);
    // B is the rounded figure; A must not exceed what that rounded B pairs with.
    expect(a).toBeLessThanOrEqual(b / ratio + 1e-8);
  });
});

