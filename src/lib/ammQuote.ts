// Pure constant-product (x·y=k) quote maths for Defibox and TacoSwap pools.
// No network access — safe to run inside the route worker.
//
// Formulas were fitted against real on-chain swaps (Sep 2026):
// - Defibox (swap.box): 0.3% of the input is charged (0.1% of it is paid out to
//   fees.box), then out = Rout·in' / (Rin + in'). Memo: `swap,<minOutRaw>,<pairId>`.
// - TacoSwap (swap.taco): 0.2% of the input goes to f.taco first, then a further
//   0.1% stays in the pool. Real swaps land within ~0.01% of this model, so the
//   quote is shaved by 1 bp to stay on the safe side. Memo: `<minOut> SYM@contract`.

export type AmmVenue = "defibox" | "taco";

export interface AmmToken {
  symbol: string;
  contract: string;
  decimals: number;
}

export interface AmmPoolState {
  venue: AmmVenue;
  /** Defibox pair id (numeric string) or Taco pair name. */
  id: string;
  /** Contract to transfer into. */
  contract: "swap.box" | "swap.taco";
  tokenA: AmmToken;
  tokenB: AmmToken;
  /** Raw integer reserves (smallest units). */
  reserveA: string;
  reserveB: string;
}

/** Fee in Alcor's display units (3000 = 0.3%) for the route panel. */
export const AMM_DISPLAY_FEE = 3000;

export function sameToken(t: AmmToken, symbol: string, contract: string): boolean {
  return t.symbol.toUpperCase() === symbol.toUpperCase() && t.contract === contract;
}

/** Exact raw output for `amountIn` raw units, or 0n when the pool can't fill. */
export function ammAmountOut(pool: AmmPoolState, inIsA: boolean, amountIn: bigint): bigint {
  if (amountIn <= 0n) return 0n;
  const rin = BigInt(inIsA ? pool.reserveA : pool.reserveB);
  const rout = BigInt(inIsA ? pool.reserveB : pool.reserveA);
  if (rin <= 0n || rout <= 0n) return 0n;
  let inAfterFee: bigint;
  if (pool.venue === "defibox") {
    inAfterFee = (amountIn * 997n) / 1000n;
  } else {
    const protocolFee = (amountIn * 2n) / 1000n;
    inAfterFee = ((amountIn - protocolFee) * 999n) / 1000n;
  }
  if (inAfterFee <= 0n) return 0n;
  let out = (rout * inAfterFee) / (rin + inAfterFee);
  if (pool.venue === "taco") out = (out * 9995n) / 10000n;
  return out > 0n ? out : 0n;
}

export interface AmmAllocation {
  pool: AmmPoolState;
  inIsA: boolean;
  amountIn: bigint;
  amountOut: bigint;
}

/**
 * Best way to push `total` raw units through the given pools, filling in
 * 1/40 steps to whichever pool adds the most output.
 */
export function allocateAcrossAmm(
  pools: Array<{ pool: AmmPoolState; inIsA: boolean }>,
  total: bigint,
): { out: bigint; legs: AmmAllocation[] } {
  if (total <= 0n || pools.length === 0) return { out: 0n, legs: [] };
  const STEPS = 40n;
  const step = total / STEPS;
  const alloc = pools.map(() => 0n);
  let remaining = total;
  while (remaining > 0n) {
    const chunk = step > 0n && remaining > step ? step : remaining;
    let bestI = -1;
    let bestGain = 0n;
    for (let i = 0; i < pools.length; i++) {
      const { pool, inIsA } = pools[i];
      const gain =
        ammAmountOut(pool, inIsA, alloc[i] + chunk) - ammAmountOut(pool, inIsA, alloc[i]);
      if (gain > bestGain) {
        bestGain = gain;
        bestI = i;
      }
    }
    if (bestI < 0) break;
    alloc[bestI] += chunk;
    remaining -= chunk;
  }
  if (remaining > 0n) return { out: 0n, legs: [] }; // pools can't absorb it
  const legs: AmmAllocation[] = [];
  let out = 0n;
  pools.forEach(({ pool, inIsA }, i) => {
    if (alloc[i] <= 0n) return;
    const o = ammAmountOut(pool, inIsA, alloc[i]);
    if (o <= 0n) return;
    legs.push({ pool, inIsA, amountIn: alloc[i], amountOut: o });
    out += o;
  });
  return { out, legs };
}

export function rawToFixed(raw: bigint, decimals: number): string {
  const neg = raw < 0n;
  const s = (neg ? -raw : raw).toString().padStart(decimals + 1, "0");
  const whole = decimals > 0 ? s.slice(0, -decimals) : s;
  const frac = decimals > 0 ? `.${s.slice(-decimals)}` : "";
  return `${neg ? "-" : ""}${whole}${frac}`;
}

/** Memo that makes the venue send `minOut` or more back to the sender. */
export function ammMemo(pool: AmmPoolState, out: AmmToken, minOut: bigint): string {
  if (pool.venue === "defibox") return `swap,${minOut.toString()},${pool.id}`;
  return `${rawToFixed(minOut, out.decimals)} ${out.symbol.toUpperCase()}@${out.contract}`;
}
