## Problem

After claiming rewards from a farm, the "You've claimed (lifetime)" total in the Rewards Card does not increase.

## Root cause

In `src/components/farm/NFTStaking.tsx`, all three claim paths (`handleClaim`, `handleStake` with pending-claim, `handleUnstake`) compute `preClaim` from `stakerData.claimableBalances`:

```ts
const preClaim = claimableBalancesToClaimed(stakerData.claimableBalances);
```

But `claimable_balances` from the contract is the **base** amount and is only materialized when state changes. Between stake/claim/unstake events it typically reads `0.0000 SYMBOL`. The actual payout the user receives is the live-accrued value: `base + ratePerHour × hoursElapsed`, which the UI already calculates into `liveRewards`.

So in normal usage `preClaim` is empty → `applyClaimToAccount` no-ops → the lifetime total never grows.

## Fix

Use the live-computed accrued rewards (`liveRewards`) as the source for `preClaim`, falling back to `claimableBalances` only if `liveRewards` is empty.

Add a small helper (in `src/lib/farmClaimHistory.ts`) to convert `PendingReward[]` (`{symbol, amount, contract, precision}`) into `ClaimedToken[]`, filtering out zero/negative amounts and entries with no symbol.

Update the three claim sites in `NFTStaking.tsx` to build `preClaim` from `liveRewards` via this new helper.

## Files to change

- `src/lib/farmClaimHistory.ts` — add `pendingRewardsToClaimed(rewards)` helper.
- `src/components/farm/NFTStaking.tsx` — replace `claimableBalancesToClaimed(stakerData.claimableBalances)` with `pendingRewardsToClaimed(liveRewards)` (with a fallback to the existing call when `liveRewards` is empty) in `handleClaim`, `handleStake`, and `handleUnstake`. Update `hasPendingClaim` in `handleStake` to also consider `liveRewards`.

## Out of scope

No changes to the Hyperion baseline fetch, storage schema, or the FarmDetail display.
