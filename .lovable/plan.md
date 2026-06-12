# Make the Current Stakers table scale to large farms

## Goal

Stop the table from overloading the browser / AtomicAssets API on farms with 100+ stakers and 50+ NFTs each, while still letting the owner see the full list.

## Pattern to follow (already used elsewhere in CHEESEHub)

- `src/components/wallet/NFTSendManager.tsx` and `src/components/farm/NFTStaking.tsx` both use **`@tanstack/react-virtual`** (`useVirtualizer`) to render only the rows currently in the viewport, regardless of total list size.
- `useUserNFTs` and `NFTStaking` batch AtomicAssets metadata fetches (size ~50) with limited parallelism, exactly like `fetchAssetsMetadata` already does in `src/lib/farmStakers.ts`.

We'll apply the same pattern to `FarmStakersTable` rather than a manual paginator. Virtualisation + the existing per-row `IntersectionObserver` together cap work to "what's on screen" no matter how many stakers exist.

## Changes

### 1. `src/components/farm/FarmStakersTable.tsx` — virtualise the row list

- Replace the current `slice(0, visibleCount)` + "Show more" button with a virtualised body using `useVirtualizer` from `@tanstack/react-virtual` (already installed; see `NFTSendManager.tsx`).
- Layout:
  - Wrap the `<TableBody>` rows in a scrollable container (`max-h-[600px] overflow-auto`) with a `ref` passed as `getScrollElement`.
  - `count = stakers.length`, `estimateSize = () => 88` (≈ row height with one preview row of thumbs), `overscan: 4`.
  - Render only `virtualizer.getVirtualItems()` as `<StakerRow>` inside an absolutely-positioned spacer, matching the `NFTSendManager` pattern.
- Remove `ROW_PAGE_SIZE`, `visibleCount`, `hiddenStakers`, and the "Show more" button — virtualisation supersedes them.
- Keep `PREVIEW_LIMIT = 8` per row and the existing `+N` expand control. When a row is expanded, call `virtualizer.measure()` / use `measureElement` so the virtualiser picks up the taller height.
- Keep `IntersectionObserver` inside `StakerRow` (it doubles as the gate for `useStakerAssetMeta`); virtualiser only mounts visible rows anyway, but the observer still defers the fetch until the row has actually painted, which avoids a burst of 8 × `overscan` requests during fast scrolls.
- Header badge keeps the **true totals** (`stakers.length wallets · totalStaked NFTs`).

### 2. No changes needed to data/fetching

- `src/hooks/useFarmStakers.ts` — already one paginated RPC, lazy per-row metadata via `useStakerAssetMeta`. Leave as-is.
- `src/lib/farmStakers.ts` — already memoises asset metadata at the module level (`assetMetaMemo`), batches by 50 with parallel limit 3, and caps `stakednfts` scans at 50 pages. Leave as-is.

### 3. Sanity caps already in place

- `MAX_STAKEDNFTS_PAGES = 50` / `MAX_GLOBAL_STAKERS_PAGES = 20` in `farmStakers.ts`.
- `staleTime: 60_000` on stakers, `5 * 60_000` on metadata.
- `templateCache.ts` 15-min TTL covers repeated template lookups.

## Verification

- `/farm/cheesefarm` (31 NFTs, ~handful of stakers): table renders the full list; no scroll bar appears; no behaviour regression.
- A large farm such as `/farm/pixeljourney` (23,338 staked NFTs across many wallets):
  - On first paint, DevTools shows the DOM contains only ~8 `<StakerRow>` elements regardless of total count.
  - Network tab shows ≤ ~2 AtomicAssets batch calls before scroll; scrolling triggers more batches lazily, and revisiting already-seen rows triggers zero new requests (module memo).
  - Memory profile stays flat while scrolling end-to-end (rows recycle).
- Expanding a row with 50+ NFTs grows it in place, virtualiser remeasures, and the page below shifts down without jank.
- No change to contract calls, transaction logic, or any other surface.
