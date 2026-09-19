// Concentrated-liquidity (Uniswap V3 style) amount math for Alcor pools.
//
// Alcor pools accept the two tokens at an exact ratio determined by the pool's
// current price and the position's tick range. Guessing that ratio from the
// amounts already sitting in a position causes the pool's "Price slippage
// check" assertion to fail, so deposits must be sized from the live slot.

export interface PoolSlot {
  /** Q64.64 square root of the raw price (rawB / rawA). */
  sqrtPriceX64: string;
  /** Current tick of the pool. */
  tick: number;
}

export type RangeState = 'in-range' | 'below-range' | 'above-range';

const TWO_POW_64 = 2 ** 64;

/** sqrt(1.0001^tick) — the sqrt price at a tick boundary, in raw units. */
export function sqrtPriceAtTick(tick: number): number {
  return Math.pow(1.0001, tick / 2);
}

export function sqrtPriceFromX64(sqrtPriceX64: string): number {
  const value = Number(sqrtPriceX64);
  if (!Number.isFinite(value) || value <= 0) return NaN;
  return value / TWO_POW_64;
}

export function rangeState(tick: number, tickLower: number, tickUpper: number): RangeState {
  if (tick < tickLower) return 'below-range';
  if (tick >= tickUpper) return 'above-range';
  return 'in-range';
}

export interface DepositRatio {
  state: RangeState;
  /**
   * Units of token B required per unit of token A, in human (display) units.
   * Null when the position is out of range or the slot data is unusable.
   */
  ratio: number | null;
}

/**
 * Exact ratio at which the pool will accept a deposit into the given range.
 *
 * In range, for liquidity L:
 *   rawA = L * (1 / sqrtP - 1 / sqrtUpper)
 *   rawB = L * (sqrtP - sqrtLower)
 * so the ratio is independent of L. Raw amounts are scaled by each token's
 * precision to reach display units.
 */
export function poolDepositRatio(
  slot: PoolSlot,
  tickLower: number,
  tickUpper: number,
  precisionA: number,
  precisionB: number,
): DepositRatio {
  const state = rangeState(slot.tick, tickLower, tickUpper);
  if (state !== 'in-range') return { state, ratio: null };

  const sqrtP = sqrtPriceFromX64(slot.sqrtPriceX64);
  const sqrtL = sqrtPriceAtTick(tickLower);
  const sqrtU = sqrtPriceAtTick(tickUpper);

  if (!Number.isFinite(sqrtP) || sqrtP <= 0 || !(sqrtU > sqrtL)) return { state, ratio: null };

  const perLiquidityA = 1 / sqrtP - 1 / sqrtU;
  const perLiquidityB = sqrtP - sqrtL;

  if (!(perLiquidityA > 0) || !(perLiquidityB > 0)) return { state, ratio: null };

  // Raw ratio (rawB per rawA) converted into display units.
  const rawRatio = perLiquidityB / perLiquidityA;
  const ratio = rawRatio * Math.pow(10, precisionA - precisionB);

  if (!Number.isFinite(ratio) || ratio <= 0) return { state, ratio: null };
  return { state, ratio };
}
