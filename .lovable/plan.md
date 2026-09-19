# Compound All: 0.75% fee to hole.cheese

Match the reference transaction: when rewards are put back into a pool, 0.75% of what would be deposited goes to `hole.cheese` first, and a small buffer of each token is left behind in the wallet.

## Behaviour

1. Claim step is unchanged — one signature claims every farm reward.
2. Planning then works from the claimed balances, minus a 0.5% buffer per token that is never touched.
3. For each position, the pair amounts are worked out as today (smaller side in full, other side matched at the position ratio) from the buffered balances.
4. Each side is then split: 0.75% is the compound fee, the rest is the deposit.
5. The compound signature contains, in order: the fee transfers to `hole.cheese` (memo `compound fee`), then the existing deposit transfers and add-liquidity actions.
6. Fee amounts that round to zero at the token's precision are dropped (no zero transfer); the deposit still goes ahead.

## What the user sees

- The preview list shows, per position, the amount being deposited for each token, with the fee shown beneath as a single small line (for example `fee 0.5061 CHEESE`).
- A short note under the preview: 0.75% of each deposit supports HOLE, and a small amount of each token stays in your wallet.
- The confirm screen mentions the 0.75% fee before the first signature, so it is disclosed before anything is signed.
- Terms checkbox gate, skipped-position list, "Keep rewards" option, and the "rewards are safe in your wallet" error path all stay as they are.

## Technical details

`src/lib/alcorCompound.ts`
- Add `COMPOUND_FEE_RATE = 0.0075`, `COMPOUND_BUFFER_RATE = 0.005`, `COMPOUND_FEE_ACCOUNT = 'hole.cheese'`, `COMPOUND_FEE_MEMO = 'compound fee'`.
- In `planCompound`, seed the remaining-balance map with `floorTo(balance * (1 - COMPOUND_BUFFER_RATE), precision)` instead of the raw balance.
- `CompoundLeg` gains `gross`, `fee`, `feeQuantity` (fee may be `0`); `amount`/`quantity` become the post-fee deposit values, so existing deposit-building code needs no change. Fee is `floorTo(gross * COMPOUND_FEE_RATE, precision)`; deposit is `floorTo(gross - fee, precision)`. A position is only skipped as dust when the deposit side rounds to zero.
- Allocation still deducts the full `gross` from the shared remaining balance.
- Add `buildCompoundFeeTotals(entries)` returning one aggregated `{ contract, symbol, amount, precision, quantity }` per token across all compoundable positions, so one transfer per token is emitted rather than one per position.

`src/components/wallet/CompoundAllDialog.tsx`
- Before the deposit actions, prepend a `transfer` action per fee total: `{ from: accountName, to: 'hole.cheese', quantity, memo: 'compound fee' }` on the token's own contract, with `accountName@active` authorization.
- Preview rows show the deposit amounts plus a muted fee line per token; add the disclosure text on the confirm and preview stages.

`src/test/alcorCompound.test.ts`
- Buffer is withheld (deposit + fee never exceeds 99.5% of the claimed balance).
- Fee is 0.75% of the gross leg and deposit is the remainder, at the token's precision.
- Zero-rounding fee produces no fee entry but still deposits.
- Aggregation sums fees per token across positions.
- Existing pairing, one-sided, dust, missing-ticks, shared-balance, and cap tests keep passing.

Verification: typecheck, the focused test files, and the preview build.
