## Goal

When a user stakes additional NFTs into a farm where they are already earning rewards, make it clear that the farm contract will automatically claim their current pending rewards as part of the stake transaction.

## Where

`src/components/farm/NFTStaking.tsx` — the "Unstaked" tab's `handleStake` flow.

## Behavior

1. Persistent inline notice on the Unstaked tab (always visible, no click needed):
   - Shown only when the user already has staked NFTs in this farm AND `totalPending > 0`.
   - Rendered above the Select All / Stake Selected row using the existing `Alert` component (info style, ℹ️ icon).
   - Copy: "You currently have **{formatted pending amounts}** pending. Staking additional NFTs will auto-claim your pending rewards as part of the same transaction."
   - Reuses the existing live `pendingRewards` array already computed in the component (so the displayed totals tick up in real time alongside the rest of the UI).

2. Confirmation step on click of "Stake Selected":
   - Only triggers when `stakedNfts.length > 0 && totalPending > 0` AND the user has not already confirmed this session for this farm.
   - Uses an `AlertDialog` (already a project primitive) with:
     - Title: "Pending rewards will be claimed"
     - Description: lists the pending amounts (symbol + formatted amount via existing precision) and explains the contract auto-claims on stake.
     - Cancel button → aborts.
     - Confirm button → proceeds with existing `handleStake` logic and, on success, calls the existing `applyClaimToAccount` path so the user's lifetime claim totals stay accurate (this already happens for the explicit Claim button — we wire the same call into the stake success path for this case).
   - If there are no pending rewards or no existing stake, stake proceeds immediately as today (no extra click).

3. After a successful stake-with-auto-claim:
   - Convert the just-claimed `pendingRewards` to the `ClaimedToken[]` shape (helper `pendingRewardsToClaimed` already imported) and call `applyClaimToAccount(accountName, farm.farm_name, claimed)` so the farm's claimed totals update immediately, matching what already happens after a manual claim.

## Out of scope

- No changes to the on-chain action itself (`buildStakeNftsAction`) — the auto-claim is contract behavior, we are only surfacing it.
- No changes to unstake or claim flows.
- No changes to other farm types (token DAOs, Alcor, etc.).

## Files touched

- `src/components/farm/NFTStaking.tsx` (UI + handler only)
