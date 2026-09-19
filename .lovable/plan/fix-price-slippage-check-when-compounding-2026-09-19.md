# Fix "Price slippage check" when compounding

## What is happening

Compounding fails at the final signing step with `assertion failure with message: Price slippage check`. That message comes from Alcor's own add-liquidity action, not from our code.

Alcor pools are concentrated-liquidity pools. When you add liquidity, the pool itself decides the exact ratio of the two tokens it will accept, based on the pool's current price and the price range of your position. Our compound feature currently guesses that ratio from how much of each token the position already holds (a figure read from Alcor's API, which can be minutes old and is rounded).

Because the guessed ratio is never exactly the pool's ratio, the pool accepts all of one token and only part of the other. We tell the pool "accept at least 99.5% of each amount", so the partially used side fails that check and the whole transaction is rejected. This will happen intermittently for any pair, which matches what you saw.

Rewards are never lost in this case — the claim is a separate transaction and the tokens stay in your wallet.

## The fix

1. Read the pool's live price and the position's price range at the moment of compounding, and calculate the exact token ratio the pool will accept.
2. Size the deposit off that exact ratio: take the reward side that limits the deposit, work out precisely how much of the other side pairs with it, and deposit only that. Anything left over stays in your wallet, as today.
3. Because the amounts are now exact rather than guessed, keep a small tolerance (0.5%) purely to absorb price movement between signing and execution.
4. If the pool price moved enough that the transaction still fails, show a clear message and let you re-check and retry without claiming again (the existing "Re-check balances" path).

## Positions whose price range no longer covers the current price

An out-of-range position can only accept one of the two tokens. Compounding into it would deposit one side and leave the other, which is not what "compound" should silently do. These positions will be skipped with a clear reason ("Position is outside its price range — only one token can be added"), so nothing is deposited unexpectedly.

## Technical detail

- `src/lib/alcorFarms.ts`: use `fetchPoolDetails(poolId)` to get `currSlot.sqrtPriceX64` and `tick`; expose it in a shape the compound planner can consume.
- New pure helper (tested) implementing Uniswap-V3-style amount math:
  - `sqrtLower = 1.0001^(tickLower/2)`, `sqrtUpper = 1.0001^(tickUpper/2)`, `sqrtP` from `sqrtPriceX64 / 2^64`.
  - In range: `L_A = rawA / (1/sqrtP - 1/sqrtUpper)`, `L_B = rawB / (sqrtP - sqrtLower)`, `L = min(L_A, L_B)`, then recompute both exact raw amounts from `L`.
  - Raw amounts scaled by each token's precision (`10^precision`) before/after the math.
  - Below range → token A only; above range → token B only; both flagged as out-of-range.
- `src/lib/alcorCompound.ts`: `CompoundCandidate` gains `sqrtPriceX64` / `currentTick`; `planCompound` replaces the `tokenB.amount / tokenA.amount` ratio with the exact pool ratio, keeps the existing claim-delta spending rule (only rewards from this claim, never wallet holdings), keeps the 0.75% `hole.cheese` fee taken from each deposited side, and adds an `out-of-range` skip reason.
- `src/components/wallet/CompoundAllDialog.tsx`: fetch pool slots for the eligible positions before planning (parallel, cached), pass them into `planCompound`, and surface a slippage-specific error message with the retry hint.
- `buildIncreaseLiquidityAction`: keep the 0.5% minimums, now applied to exact amounts rather than guessed ones.
- Tests in `src/test/alcorCompound.test.ts`: in-range ratio math against a known pool slot, limiting-side selection, out-of-range skip, fee and claim-delta behaviour unchanged.
