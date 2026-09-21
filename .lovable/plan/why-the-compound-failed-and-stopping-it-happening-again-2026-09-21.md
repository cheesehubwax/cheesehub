# Why the compound failed, and stopping it happening again

## What the chain shows for benoisballzz

- Rewards were claimed at 10:01:22 (11.8173 CHEESE, 1.1817 LSWAX, 4.6651 CHEESE, 0.5859 CHEESE, 0.0879 LSW and two dust amounts) and claimed again at 10:02:14, the second time only dust.
- There is no deposit to Alcor and no 0.75% fee transfer at either time. So the second transaction was rejected as a whole — nothing was deposited and no fee was taken.

## Why the claim stuck

Compound All is deliberately two signatures: one to claim, one to deposit. A rejected deposit cannot undo a claim that already succeeded in an earlier transaction, so the rewards simply stay in the wallet and the "Re-check balances" retry exists for exactly this case. Nothing was lost. Staying with two steps is confirmed as the design.

## What is being rejected, and why this is not yet proven

The rejection comes from Alcor's own add-liquidity check: each deposit says "use at least 97% of both amounts I sent". The pool recomputes the usable amounts itself and rejects the deposit if either side falls under that line. The amounts involved here were very small, and small amounts are where the deposit is most fragile — the pool's integer rounding is a much larger share of a tiny deposit than of a large one.

That is the most likely cause, but it is not confirmed from the chain data alone, and the account cannot be retried. So the first step is to establish the cause before changing behaviour.

## Plan

1. Reconstruct the exact rejected deposit offline. Using the claimed amounts above, each position's tick range, and the pool prices of those pools, compute what the deposit sizing would have produced and what Alcor's own maths would accept. This is a read-only script against the live chain; it names the cause instead of guessing it.
2. Fix whatever step 1 identifies. The candidates, in order of likelihood:
   - Deposits too small to survive the pool's rounding: introduce a minimum viable deposit per side and skip below it with a plain reason ("this reward is too small to add as liquidity yet"), rather than sending a deposit that will be rejected.
   - Minimums too tight for small amounts: set each minimum as the greater of the percentage buffer and a one-unit-of-precision allowance, so rounding alone can never trip the check.
   - Price drift between planning and signing: re-read the pool price immediately before building the deposit and refuse to sign a plan older than a few seconds, prompting a re-check instead.
3. Protect the rest of the batch. Today one bad position rejects every deposit in the transaction. Each position's deposit becomes independently sized and validated before signing, and any position that cannot be sized safely is skipped and listed rather than taking the whole batch down.
4. Stop the accidental double claim. After a successful claim the dialog will not re-run the claim step, so pressing again re-checks balances instead of claiming a second time for dust.
5. Make the failure message state the position and the reason it was rejected, not just "the price moved".

## Verification

- Unit tests for the new sizing rules: minimum-viable deposit, one-unit precision allowance on the minimums, per-position skip instead of whole-batch failure, and the claim-once guard.
- A replay test built from the real benoisballzz amounts and pool ranges, asserting the new logic either produces an acceptable deposit or skips with a clear reason — never the rejected deposit that was actually sent.

## Technical notes

- `src/lib/alcorCompound.ts`: `planCompound` gains a minimum-viable-deposit guard per side (derived from the pool's raw-unit rounding at the position's range) and a new skip reason; fee/claim-delta rules unchanged.
- `src/lib/alcorFarms.ts`: `buildIncreaseLiquidityAction` minimums become `min(desired * (1 - tolerance), desired - 1 unit of precision)` floored at precision, so a single raw unit of pool rounding can never breach them.
- `src/components/wallet/CompoundAllDialog.tsx`: claim-once guard on `runClaimAndPlan`, pool-slot freshness timestamp checked in `runCompound`, per-position error detail in the slippage message.
- `src/test/alcorCompound.test.ts`: new cases plus the benoisballzz replay fixture.
