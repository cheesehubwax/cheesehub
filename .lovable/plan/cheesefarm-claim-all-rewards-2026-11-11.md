# CHEESEFarm: Claim All Rewards

## What you will get
- A **"🧀 Claim All"** button at the top of Browse Farms (visible when signed in and you have staked NFTs in any farm).
- Clicking it opens a preview window listing every farm you are staked in that has rewards ready, each with a tick box and its reward amounts (e.g. "120.5 CHEESE, 3.2 WAX"), plus the combined total.
- Farms with nothing to claim are shown greyed out and are skipped automatically, so one empty farm can't make the whole claim fail.
- Confirm sends the claims in small groups (5 farms per signing). A progress bar shows "Batch 2 of 4", and each finished batch shows its transaction link. If one batch fails, the others still go through and the failed farms stay ticked so you can retry them.
- Terms of Use tick box is not required (claiming is not a lock, create or deposit), matching the existing single Claim button.

## How it works
1. One chain lookup finds all farms you are staked in, with their claimable balances (the farm contract keeps a per-user list).
2. Only farms with a claimable balance above zero, that are still open, are pre-ticked.
3. Each batch is one wallet signature containing several standard `claim` actions, sent with Greymass Fuel, and the transaction ID is verified before marking it done.
4. After finishing, farm cards and claim totals refresh.

## Things to know
- Amounts shown are what the contract reports as ready; the final amount paid can be slightly higher because rewards keep accruing until the moment you sign.
- Users with many farms will sign more than once (one prompt per 5 farms) to stay within WAX CPU limits.
- No legal concerns: it only bundles claims the user could already make one by one; nothing is held or routed by CHEESEHub.

## Technical details
- `src/lib/farm.ts`: add `fetchUserClaimables(account)` using `stakers` index 2 (name, bounded limit, paginated to completion; flag partial if incomplete) returning `{ farmName, claimable_balances, asset_ids }`; add pure `planClaimBatches(rows, size=5)` that drops zero/empty balances and chunks.
- New `src/components/farm/useClaimableFarms.ts` (react-query, resolveEndpoints via existing fetchTableRows) and `src/components/farm/ClaimAllFarmsDialog.tsx` (selection, totals per token contract+symbol using integer asset math, sequential batch runner reusing existing transact/Fuel helper and `buildClaimRewardsAction`, per-batch TX verification, retry of failures).
- `BrowseFarms.tsx`: add button in the filter bar, open dialog, invalidate farm/stake/claim-total queries on completion.
- Tests `src/test/farmClaimAll.test.ts`: zero-balance farms excluded; 12 ready farms → batches of 5,5,2; totals sum per token without float rounding.
- Verify in preview with a signed-in session that the dialog lists staked farms (signing itself can't be exercised here).
