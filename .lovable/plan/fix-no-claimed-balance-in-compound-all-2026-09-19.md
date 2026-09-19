# Fix "no claimed balance" in Compound All

## What went wrong

After the claim, the dialog looks up how much of each reward token is now in your wallet. That lookup needs the token's issuing contract. For staked farms, the reward contract comes from Alcor's incentive record — when that record is not resolved (cache miss, API hiccup, table read failure), the contract comes back empty.

Two things then happen:

1. The balance request is sent with an empty contract. The chain answers with an error, and the current code quietly treats any failed read as "balance 0" (confirmed: a balance request with an empty contract returns a 500 account-query error, and the helper turns that into 0).
2. Eligibility still passes, because pairing is matched by token symbol. So each pair is judged compoundable, then immediately skipped with "No claimed balance left for both sides of this pair" — which is wrong; the balance was never actually read.

That matches exactly what you saw: every position skipped with the same message, rewards sitting safely in the wallet.

## The fix

1. Resolve token contracts properly before reading balances
   - Build the read list from both the farm reward tokens and the pool's own token records, preferring any entry that has a real contract for a given symbol.
   - Drop entries with no contract instead of sending a doomed request.
   - Resolve any still-unknown symbol from the app's existing token list before giving up.

2. Stop treating a failed read as zero
   - The balance reader returns three outcomes: a real amount, zero, or "could not read".
   - When a side could not be read, the position is skipped with its own honest message ("Couldn't read your SYMBOL balance — try again"), never "no balance left".

3. Make the wording truthful for the remaining cases
   - Truly zero balance: "No SYMBOL arrived from this claim."
   - Balance already used by a bigger position in this same click: "Claimed SYMBOL was used by a larger position in this pair."

4. Recovery without re-claiming
   - Add a "Re-check balances" button on the preview stage that re-reads balances and rebuilds the plan, so after a hiccup you can compound the rewards you already claimed without claiming again.
   - If every balance read fails, say so plainly and point at that button.

5. Tests
   - Unknown-balance skip reason, symbol resolved via pool token contract when the reward contract is missing, zero-balance vs consumed-by-larger-position wording, and existing pairing/fee/buffer tests keep passing.

## Technical notes

- `src/lib/alcorCompound.ts`: add `'balance-unknown'` to `CompoundSkipReason`; accept a balance map whose values carry a `known` flag; split the current `no-balance` branch into unknown / zero / consumed cases; helper to merge candidate token contracts with reward token contracts into a de-duplicated read list preferring non-empty contracts.
- `src/components/wallet/CompoundAllDialog.tsx`: `readBalance` returns `{ balance, precision, known }` and marks `known: false` on request failure (distinguishing a real empty `[]` result from an error); build `tokensToRead` from reward tokens plus `tokenA`/`tokenB` of eligible candidates; add the re-check action wired to the existing plan builder.
- Verify with `bunx tsgo --noEmit -p tsconfig.app.json`, `bunx vitest run src/test/alcorCompound.test.ts`, and the build log.
