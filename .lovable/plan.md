# Scale the Stakers Table for Large Farms

## Current cost (worst case)

- `stakednfts` scan: 1 RPC call per 1000 rows, capped at 20 pages (~20k assets). Fine.
- Asset metadata: **every** asset id is fetched upfront via AtomicAssets in batches of 50, 3 parallel. For a 5,000-NFT farm that's ~100 HTTP calls before anything renders, even though only ~8 thumbnails per wallet are visible until the user clicks "+N".
- Render: every staker row mounts at once; long tail of empty `<Thumb>` HoverCards.

So `cheesefarm` (31 NFTs) is fine, but a 5k-NFT farm spams the atomic API and delays first paint by several seconds.

## Plan

### 1. Lazy metadata — only fetch what's visible
Replace the single "fetch every asset" query with per-wallet on-demand fetching:

- The component renders rows immediately from the (cheap) `stakednfts` data — wallet, staked count, asset-id chips as placeholders.
- For each row, fetch metadata only for the **first 8 asset ids** (the preview strip). Use `useQueries` keyed by `(farmName, user, previewSlice)` so each row's preview is cached independently and runs in parallel but bounded.
- When the user clicks "+N", fetch metadata for the remainder of that wallet's asset ids (one extra query per expansion).

This shrinks the cold-load fetch from `ceil(totalAssets/50)` calls to `ceil(stakers*8/50)` calls. For a 5k-NFT farm with 100 stakers that's ~16 calls instead of ~100, and most rows reuse cached templates anyway.

### 2. Cache by template, not by asset
Most farms stake many copies of the same template, so the dominant cost is repeated `name+image` for the same artwork.

- Switch `fetchAssetsMetadata` to a two-step fetch:
  1. One small `/atomicassets/v1/assets?ids=...` call to map `asset_id → template_id, mint, collection`.
  2. Resolve `name + image` via the existing **`templateCache` + `fetchTemplatesBatch`** in `src/services/atomicApi.ts` / `src/lib/templateCache.ts`.
- That cache is process-wide and 15-min TTL, so revisiting a farm or scrolling between farms is effectively free.
- Asset-id → template_id results are also memoized in a module-level `Map` so re-expanding a row never re-hits the API.

### 3. Paginate stakers in the UI
Even with cheap rows, mounting hundreds of `<TableRow>`s is wasteful.

- Show the top 50 stakers by staked count by default with a "Show more" button (loads +50). Total count and aggregate NFT count remain in the header badge so the owner always knows the full size.
- Optional simple search input (filter by wallet) gated behind a small icon — only renders rows that match.

### 4. Hard safety caps
- Stop `stakednfts` pagination at 50k assets (≈50 RPC calls) and surface a small "Showing first 50,000 staked NFTs" notice. Real V2 farms don't approach this; the cap just prevents a runaway loop if a contract returns malformed `more=true`.
- Per-row preview fetch only fires when the row is in (or near) the viewport using `IntersectionObserver`. Cheap to add, eliminates work for off-screen rows when "Show more" reveals a long list.

### 5. Verification
- Re-test `/farm/cheesefarm` (31 NFTs) — visually identical, fewer requests.
- Spot-check a large farm (e.g. a public 1000+ NFT WaxDAO V2 farm) in the network tab: cold-load should issue ≤ ~20 atomic-API calls regardless of total NFT count, and "+N" expansions should add one call each (or zero if templates were already cached).

## Files touched

- `src/lib/farmStakers.ts` — split `fetchAssetsMetadata` into `fetchAssetsTemplateIds` + use `templateCache.batchGetOrFetch`; add module-level asset→template memo; add the 50k cap.
- `src/hooks/useFarmStakers.ts` — drop the eager all-assets query. Return only stakers + a `useStakerAssetPreview(user, ids)` helper that lazily resolves metadata.
- `src/components/farm/FarmStakersTable.tsx` — render rows from stakers directly; per-row preview hook with `IntersectionObserver`; "Show more" pagination of 50; expand-on-click loads the remainder.

No contract calls, no schema changes, no new dependencies.
