## Problem

When you stake more NFTs into a farm where you already have NFTs staked, the WaxDAO V2 `farms.waxdao` contract recalculates your stake state and your pending (unclaimed) rewards are wiped — no tokens are sent to your account, so it looks like the claimable balance vanished.

The unstake flow already handles this correctly:

```
src/components/farm/NFTStaking.tsx:791
const claimAction   = buildClaimRewardsAction(accountName, farm.farm_name);
const unstakeAction = buildUnstakeNftsAction(accountName, farm.farm_name, ids);
executeTransaction([claimAction, unstakeAction], …)
```

But the stake flow does not:

```
src/components/farm/NFTStaking.tsx:759
const action = buildStakeNftsAction(accountName, farm.farm_name, ids);
executeTransaction([action], …)
```

## Fix

Update `handleStake` in `src/components/farm/NFTStaking.tsx` to prepend a claim action when the user already has staked NFTs in this farm with a non-empty claimable balance:

1. Check `stakedNfts.length > 0` and that `stakerData.claimableBalances` has any non-zero entries (use the existing `stakerData` memo).
2. If yes, build `buildClaimRewardsAction(accountName, farm.farm_name)` and prepend it to the actions array passed to `executeTransaction`.
3. Update the success toast description to mention the auto-claim when one was included (e.g. "Claimed pending rewards and staked N NFT(s)").
4. Leave the no-existing-stake path unchanged (single stake action).

No changes to `lib/farm.ts`, contract bindings, or other dialogs. Unstake flow already correct and stays as-is.

## Verification

- Stake additional NFTs while having a non-zero claimable balance → wallet signs a 2-action tx (claim + stakenfts), CHEESE arrives in the user's account, new NFTs are staked, claimable resets to 0 only because it was just paid out.
- Stake into a farm with no prior stake → single-action tx as before.
- Greymass Fuel transact plugin path unchanged (executeTransaction already wires it).
