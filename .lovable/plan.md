# Farm Stakers Table (Owner View)

Add a table to `FarmDetail` — visible only to the farm's owner — listing every wallet currently staking in their farm, how many NFTs each has staked, and small thumbnails of those NFTs (mirrors the visual style of `DropPurchaseLog`).

## Where it lives

- New component: `src/components/farm/FarmStakersTable.tsx`
- Rendered inside `src/components/farm/FarmDetail.tsx`, gated by `farm.creator === accountName` (or whichever field holds the owner — confirmed during implementation).
- Placed near existing owner-only management controls (Kick Users / Manage Stakable Assets area), in its own card with header "Current Stakers".

## Data source

Reuse the existing on-chain `stakers` table already queried in `src/lib/farm.ts`:

- New helper `fetchFarmStakers(farmName)` in `src/lib/farm.ts`:
  - Calls `fetchTableRows({ code: 'farms.waxdao', scope: farmName, table: 'stakers', limit: 1000 })` with pagination until exhausted.
  - Normalizes each row to `{ user, assetIds: string[] }` (handles the `asset_ids | staked_assets | assets` field variants already in use).
- New hook `useFarmStakers(farmName, enabled)` in `src/hooks/useFarmStakers.ts` using `@tanstack/react-query` with a ~60s staleTime and a manual Refresh button.

## NFT thumbnails

- Collect all unique `asset_ids` across all stakers.
- Fetch asset → template metadata via the existing AtomicAssets service (`src/services/atomicApi.ts`) using batched calls; cache through `src/lib/templateCache.ts` so repeat renders are free.
- Each row shows up to ~6 thumbnails inline (32×32, rounded, `loading="lazy"`) followed by `+N more` if the staker has more. Hovering a thumbnail shows the asset id via `HoverCard` (matches the `NFTGridCard` pattern used elsewhere).

## Table columns

Modeled on `DropPurchaseLog`:

| Wallet | Staked Count | NFTs (thumbnails) | Explorer |
|---|---|---|---|
| `font-mono` account, links to `waxblock.io/account/<user>` | numeric badge | thumbnail strip + overflow | link to the staker on waxblock |

Sorted by staked count desc by default. Empty state: "No active stakers yet."

## Loading / error states

- Skeleton rows while the stakers query is loading (same `Skeleton` pattern as `DropPurchaseLog`).
- If template metadata is still loading, show a muted placeholder square per asset id; replace in place as data arrives.
- Errors surface a small inline message with a Retry button; never block the rest of `FarmDetail`.

## Out of scope

- No kick/unstake actions from the table (those already exist in `KickUsersDialog`).
- Non-owners do not see this table at all.
- No CSV export in this pass (easy follow-up if requested).

## Technical notes

- Owner field: confirm whether `FarmInfo` exposes `creator` / `owner` / `farm_owner` before gating; fall back to whichever field `fetchFarmDetails` returns.
- The `stakers` table is already scoped by `farmName`, so a single scoped query returns only this farm's stakers — no client-side filtering required.
- Thumbnail fetch is bounded: assets are deduped before requesting, and `templateCache` already enforces an LRU cap.
- Pure read-only feature; no contract actions, no new migrations, no secrets.
