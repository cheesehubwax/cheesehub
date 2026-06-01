## Goal

Make `.cheese.meme` (a semi-premium account name that sold previously) show up in the Account Names → Semi-Premium grid as a SOLD placeholder card.

## Root cause

`src/pages/Drops.tsx` `officialDrops` memo explicitly filters out sold-out drops (`isSoldOut` = remaining ≤ 0). So even if `.cheese.meme` is still indexed on-chain, it never reaches the grid. The new SOLD overlay we just shipped has nothing to render.

## Changes

1. **`src/pages/Drops.tsx` — stop filtering sold-out drops out of the Official tab.**
   - In `officialDrops`, drop the `isSoldOut` exclusion. Keep `isEnded` and `isNotStarted` filters (those are time-based, not supply-based, and we don't want expired drops resurfacing).
   - Same change in `cheeseDrops` for consistency with the user's earlier "apply same placeholder to any of the other drops if they sell out" instruction.
   - Result: any sold-out, non-expired drop appears with the grayscale + SOLD overlay and sinks to the bottom of its grid (handled by `SimpleDropGrid`/`VirtualizedDropGrid`).

2. **`src/pages/Drops.tsx` — hardcoded fallback for `.cheese.meme`.**
   - If after the filter above, `semiPremiumAccountDrops` does not contain a drop whose `name` matches `.cheese.meme` (case-insensitive), synthesize one and prepend it. The grid's sort will still push it to the bottom because `remaining = 0`.
   - The synthetic entry uses:
     - `id`: `historical-cheese-meme`
     - `name`: `.cheese.meme`
     - `collectionName`: `cheesenftwax`
     - `schemaName`: `accountnames`
     - `description`: short note that the name was claimed (e.g. "Premium .meme account name — claimed.")
     - `image`: reuse the image of the first available account-name drop already in `accountNamesDrops` so it visually matches. If none is loaded yet, fall back to `/placeholder.svg` (the grayscale overlay still reads as SOLD).
     - `price`: `200`, `currency`: `CHEESE`, `prices`: `[{ price: 200, currency: 'CHEESE', listingPrice: '200.0000 CHEESE' }]`
     - `totalSupply`: 1, `remaining`: 0, `attributes`: [].

3. **No DropCard / grid changes** — sold-state styling, non-clickability, and bottom-sink reordering all already work from the previous turn.

## Out of scope

- Recording the actual buyer / sale TX (display-only placeholder).
- Touching the `/drops/:id` detail route (sold cards are already non-clickable).
- Changing fetchers, caches, or contract reads.

## Open question (no blocker)

If the on-chain `.cheese.meme` drop is also still indexed, the page will show two cards (the real one + the hardcoded fallback). The dedupe check in step 2 prevents that. If you'd rather skip the hardcoded fallback entirely and rely only on the unfiltered on-chain data, say the word and I'll drop step 2.
