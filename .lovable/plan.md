# Compound tiny WAXWBTC rewards instead of skipping them

## What happened

The compound went through, but the CHEESE/WAXWBTC pair was left out. The claim was 0.00000068 WAXWBTC — about six cents, and an amount Alcor itself accepts as liquidity.

Compound All currently refuses any deposit below roughly 67 of a token's smallest units. That floor was added after the earlier "Price slippage check" failure: it was derived from the 3% price tolerance we send with the deposit (2 smallest units / 3%), on the assumption that the pool's own rounding could eat more than the tolerance allows on very small amounts. 0.00000068 WAXWBTC is 68 units — right on that line, so the exact reason it dropped out (the blanket floor, or the amount falling under it once it was matched to the CHEESE side and the 0.75% fee was taken) is not yet confirmed. Confirming it is the first step, not an assumption.

## Plan

1. Replay the pair read-only against the live chain and the position's real price range to determine exactly which rule dropped it and at what amount.
2. Replace the percentage-derived floor with the pool's real constraint: a deposit only needs to be at least 1 smallest unit on each side, with the minimum we send to the pool relaxed by a fixed couple of smallest units on tiny amounts instead of a flat percentage. That is what lets a 68-unit WAXWBTC deposit through while still protecting larger deposits from price movement.
3. Keep matching both sides exactly to the pool's live ratio (unchanged), so the pair still lands on the ratio the pool demands.
4. Keep a skip only for genuinely impossible deposits — a side that rounds to zero units.
5. Re-run the compound tests, add cases for the 68-unit WAXWBTC amount and for 1–2 unit edge cases, and confirm the build is clean.

## Technical detail

- `src/lib/alcorCompound.ts`: drop `MIN_DEPOSIT_RAW_UNITS = Math.ceil(2 / COMPOUND_SLIPPAGE_TOLERANCE)`; the `deposit-too-small` skip fires only when either side rounds to 0 raw units. Deposit sizing (B from the rounded A, A re-derived from the rounded B) stays as is.
- `src/lib/alcorFarms.ts` `buildIncreaseLiquidityAction`: `minQuantity` becomes `max(0, desired_raw - max(ceil(desired_raw * tolerance), 2))` in raw units, then formatted at the token's precision — an absolute allowance that behaves sanely at 68 raw units and stays effectively percentage-based on large amounts.
- `src/test/alcorCompound.test.ts`: replace the 67-unit threshold tests with the 0.00000068 WAXWBTC case (expected to compound), a 1-unit case, and a 0-unit case (skipped); keep the ratio-alignment and claim-delta tests.
- `src/test/` coverage for `minQuantity` output at tiny and large amounts.

## Risk

The wider absolute allowance on very small deposits means a 68-unit WAXWBTC deposit could, in the worst case, be filled a couple of units short. That is fractions of a cent, and it is the same tolerance Alcor's own interface uses for small adds.
