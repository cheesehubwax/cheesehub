

## Add collection-wide RAM calculation for drops

### Problem
Currently, the RAM check in CreateDrop only considers the **new drop's** `maxClaimable` when calculating required RAM. It doesn't account for other active mint-on-demand drops in the same collection that also consume RAM when claimed. If you have 6 drops with 9 NFTs each, the RAM needs to cover all 54 potential mints, not just 9.

### Solution
Fetch all active drops for the collection from the `nfthivedrops` table, sum up remaining claimable NFTs across all mint-on-demand drops, then add the new drop's count to get the true total RAM requirement.

### Changes

**1. `src/lib/drops.ts`** — New function `fetchCollectionActiveDropsClaims`
- Query the `nfthivedrops::drops` table filtered by collection
- For each active mint-on-demand drop (has `assets_to_mint`, not ended, not fully claimed), calculate `max_claimable - current_claimed`
- Return the total remaining claimable count across all existing drops

**2. `src/components/drops/CreateDrop.tsx`** — Update RAM shortage calculation
- Import and call the new function when collection name changes
- Store existing drops' total remaining claims in state
- Update `ramShortage` to use `existingClaims + newDropClaimCount` instead of just `newDropClaimCount`
- Show the breakdown in the RAM warning (e.g., "9 from this drop + 54 from 6 existing drops = 63 total NFTs")

### Technical details
- Uses `fetchTableRows` from `waxRpcFallback` (same pattern as `fetchRawDrops`)
- Filters: `collection_name` match, `assets_to_mint.length > 0` (mint-on-demand only), `end_time` not passed or 0, `current_claimed < max_claimable`
- RAM formula: `totalRemainingClaims * BYTES_PER_NFT` vs `ramBalance.bytes`
- The table can be scoped to the contract and filtered client-side (same as existing pattern)

### Files changed
1. `src/lib/drops.ts` — add `fetchCollectionActiveDropsClaims`
2. `src/components/drops/CreateDrop.tsx` — integrate collection-wide RAM check

