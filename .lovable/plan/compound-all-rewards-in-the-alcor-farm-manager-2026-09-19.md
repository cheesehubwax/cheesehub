# Compound All Rewards in the Alcor farm manager

Add a one-click "Compound All" next to the existing "Claim All" that claims farm rewards and immediately puts them back into the same liquidity positions, pairing as much as possible.

## How it behaves

1. Click "Compound All". First approval: claim rewards from every staked farm (the same action set "Claim All" already sends).
2. The app waits for the claimed tokens to land in your wallet and reads the real balances.
3. For each position, it works out how much can be paired at that position's current ratio: the smaller reward side is used in full, and the matching amount of the larger side goes in with it.
4. Second approval: one transaction that deposits and adds liquidity for every position that qualifies.
5. Surplus reward (the excess side) simply stays in your wallet. Nothing is swapped.

Rules agreed:

- A position is skipped when the claimed rewards do not cover both of its tokens (for example rewards paid in a token that isn't in that pool). Skipped positions are listed in the result so it is clear why.
- Positions missing tick data are skipped (they cannot be topped up safely), same guard the existing Add Liquidity dialog uses.
- Up to 20 positions per click. If more qualify, the extras are reported and can be compounded with a second click.
- Terms of Use confirmation required before signing, as with other sensitive actions.
- A preview panel before signing shows, per position, what will be added and what will be skipped.

## Edge cases

- Nothing claimable: button disabled with a reason.
- Claim succeeds but compounding fails: rewards are already yours; the error message says so explicitly and invites a retry. No rewards can be lost by the second step failing.
- Dust amounts below the token precision are skipped rather than sent as zero.
- Reward tokens shared across several positions of the same pair are allocated per position from the actual claimed balance, so the total never exceeds what was received.

## Technical notes

- `src/components/wallet/AlcorFarmManager.tsx`: new `handleCompoundAll` beside `handleClaimAllRewards`, new button, preview dialog, terms gate, progress/disabled states.
- Reuse `buildClaimRewardsAction` for step 1 and `buildIncreaseLiquidityAction` (per position, with the existing 0.5% slippage minimums) for step 2, concatenating the action arrays into one `session.transact` with `getTransactPlugins(session)`.
- Balance read between steps via `useAllTokenBalances` refetch with a short poll until the claimed deltas appear, capped by a timeout that falls back to the pre-claim + expected-reward estimate only when the poll confirms an increase.
- Pairing ratio per position from `tokenB.amount / tokenA.amount` (the ratio the Add Liquidity dialog already uses), amounts formatted at each token's precision.
- New pure helper, e.g. `src/lib/alcorCompound.ts`, with `planCompound(positions, claimedBalances)` returning `{ compoundable, skipped }`, plus unit tests in `src/test/` covering: both sides present, one side missing, dust, 20-position cap, and shared reward token across positions.
- Verify transaction IDs on success and surface them through `onTransactionSuccess`, as the other farm actions do.
