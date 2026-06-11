# Fix: FarmStakersTable returns empty

## Root cause

`fetchFarmStakers` queries `farms.waxdao` table `stakers` with `scope: farmName`. On the V2 contract, the `stakers` table is scoped by the **contract** (`FARM_CONTRACT`), with each row carrying a `farmname` field — see `fetchUserStakes` (Strategies 0/0b) in `src/lib/farm.ts`. Using `scope: farmName` returns 0 rows, so the table shows "No active stakers yet" even when 31 NFTs are staked.

## Fix

Rewrite `fetchFarmStakers` in `src/lib/farmStakers.ts` with the same multi-strategy approach used elsewhere in `farm.ts`:

1. **Primary — per-asset table:** `fetchTableRows({ code: FARM_CONTRACT, scope: farmName, table: 'stakednfts', limit: 1000 })`, paginated. Each row maps to `{ owner|staker|user, asset_id }`. Group asset_ids by owner. This matches Strategy 2 in `fetchUserStakes` and is the cheapest correct query.
2. **Fallback — global stakers scan:** if `stakednfts` returns 0 rows, paginate `fetchTableRows({ code: FARM_CONTRACT, scope: FARM_CONTRACT, table: 'stakers', reverse: true, limit: 1000 })` and keep rows where `row.farmname === farmName || row.farm_name === farmName`, reading `asset_ids | staked_assets | assets`. Stop at `MAX_ITERATIONS = 20`.
3. Merge results, dedupe per `(user, asset_id)`, sort by staked count desc. Keep the existing return shape so the hook/component need no changes.

No other files change. Asset metadata fetching (`fetchAssetsMetadata`) and the React layer stay as-is.

## Verification

After the fix, on `/farm/cheesefarm` as creator `fragglerockk` the "Current Stakers" card should list the wallets covering all 31 staked NFTs with thumbnails. Confirm via the browser preview and console (no more silent empty response).
