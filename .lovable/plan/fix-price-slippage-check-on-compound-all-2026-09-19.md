# Fix "Price slippage check" on Compound All

The deposit is still rejected by the pool. Sizing the deposit at the pool's ratio was
necessary but not sufficient: the deposit also carries a hard minimum for each token,
and any small difference between our figures and the pool's own calculation trips it.

## What is going wrong

Each deposit says "add this much of both tokens, and fail unless at least 99.5% of each
is actually used". The pool recomputes the usable amounts itself, at its own price, with
integer maths. Three things can push one side under that 99.5% line:

- the pool price moves between reading it and signing (every trade moves it),
- the price we read can come from a cached copy that is seconds to minutes old,
- rounding: our ratio is worked out in decimals, the pool's in integers.

So the fix is the buffer you suggested, plus removing the two avoidable sources of drift.

## The fix

1. Widen the tolerance for compound deposits. The minimums become a deliberate buffer
   (about 3%) instead of the 0.5% default, so normal price movement and rounding no
   longer reject the transaction. Manual "add liquidity" elsewhere keeps its current
   0.5% behaviour.
2. Shade the paired side slightly above the exact ratio, so the pool always has enough
   of both tokens to hit the amounts it wants. Unused remainder is not lost — it stays
   credited to the account inside Alcor. This will be confirmed on-chain before shipping;
   if any remainder would be stranded instead, this step is dropped and only the wider
   tolerance is used.
3. Read the pool price fresh from the chain at compound time (the pool's own table
   first, the public API only as a fallback), so the ratio is based on the current
   price rather than a cached one.
4. Confirm the two tokens are being paired in the pool's own order. If a position can
   report them in the opposite order to the pool, the ratio is upside down and every
   deposit fails — this is checked and handled explicitly.
5. Keep the honest skips already in place (outside price range, price unreadable) and
   the "Re-check balances" retry, so a rejected attempt never needs a second claim.

## Verification

- Automated tests: the buffer is applied to the minimums, the shaded side never exceeds
  the claimed amount, and pairing order is respected.
- A real Compound All click against a live pool, confirming the transaction succeeds and
  the amounts deposited match the preview.

## Technical notes

- `buildIncreaseLiquidityAction` (`src/lib/alcorFarms.ts`) gains an optional slippage
  tolerance; `tokenAMin`/`tokenBMin` derive from it. Compound passes ~3%.
- `fetchPoolSlot` reads `swap.alcor` `pools` (`currSlot.sqrtPriceX64`, `currSlot.tick`)
  directly, API shape kept as fallback; no cached pool detail path for compounding.
- `planCompound` (`src/lib/alcorCompound.ts`) keeps `poolDepositRatio` sizing, adds the
  small overshoot on the ratio-matched side within the claimed balance, and records the
  overshoot in the preview totals so the fee split stays exact.
- Tests extended in `src/test/alcorCompound.test.ts`; new coverage for the minimum
  calculation in `buildIncreaseLiquidityAction`.
