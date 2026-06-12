## Goal

For busy farms, stop auto-loading any NFT thumbnails in the Current Stakers table. Each row shows only the wallet + staked count + a single `+N` expander button. Clicking the expander reveals that wallet's thumbnails (first 8, then a further `+N` to see the rest, exactly like today). This prevents AtomicAssets / IPFS request storms on farms like PixelJourney (~23k staked NFTs).

## Trigger

A farm is considered "large" when `totalStaked >= 500` (sum of `assetIds.length` across all stakers).

- Small farm (< 500): unchanged behaviour — each row auto-renders up to 8 thumbnails, with `+N` expander for the rest.
- Large farm (>= 500): every row starts fully collapsed — zero thumbnails rendered, only a `+{assetIds.length}` button. Clicking it expands that row to the normal "8 thumbs + further expander" view the user already knows.

The 500 threshold lives as a single constant (`LARGE_FARM_THRESHOLD = 500`) at the top of `FarmStakersTable.tsx` so it's easy to tune later.

## Scope of changes

Only `src/components/farm/FarmStakersTable.tsx`. No data-layer, hook, or fetching changes — `useFarmStakers` / `fetchAssetsMetadata` already gate network calls on visible asset ids, so rendering zero thumbs means zero requests.

### Edits in `FarmStakersTable.tsx`

1. Add `const LARGE_FARM_THRESHOLD = 500;`
2. Compute `const isLargeFarm = totalStaked >= LARGE_FARM_THRESHOLD;` in `FarmStakersTable`.
3. Pass `isLargeFarm` into each `StakerRow`.
4. In `StakerRow`, introduce a `collapsedAll` state derived from `isLargeFarm && !userExpanded`:
   - When `collapsedAll` is true: render no `<Thumb>` elements; render only one button `+{assetIds.length} ▾` that, when clicked, sets the row to the existing "expanded preview" view (first 8 thumbs + existing `+N` further expander).
   - When the user collapses again, it returns to the `+{assetIds.length}` state.
5. Keep `useStakerAssetMeta(visibleIds, inView)` — when `visibleIds` is empty no fetch fires (hook already guards on `assetIds.length > 0`).
6. Adjust `estimateSize` so collapsed-all rows use the slim height (~56 px) since there are no thumb rows. Existing `measureElement` corrects any drift.
7. Header badge gets a small hint on large farms: `… NFTs · click +N to load thumbnails` (muted), so users understand why rows look empty.

### Out of scope

- `useFarmStakers.ts`, `farmStakers.ts`, virtualizer config, paging caps — unchanged.
- Daily-powerup workflow — unchanged (still paused).

## Verification

- `/farm/cheesefarm` (small): behaviour identical to today — thumbs render up to 8 on each row.
- `/farm/pixeljourney` (large, ~23k staked): table opens with zero AtomicAssets requests, all rows show only `+N` buttons. Expanding a single wallet triggers exactly one metadata batch (≤ 8 ids). Collapsing then re-expanding the same wallet triggers zero new network requests (module-level `assetMetaMemo` already covers it).
- Network panel: at most one `atomicassets/v1/assets?ids=…` request per user-initiated expand on large farms; none on load.
