

## Fix: Premint drop blank images and broken NFTHive link

### Root Causes Found

1. **Image resolution fails because `pools` table lookup is wrong.** The code queries the `pools` table using `drop_id` as lower/upper bound, but `pools` is indexed by its own auto-incrementing `pool_id`, NOT by `drop_id`. So the query always returns nothing or the wrong row, and the image stays as `/placeholder.svg`.

2. **Premint detection is correct** for the user's drops (`assets_to_mint: []` triggers `isPremint = true`), but the fallback image path after detection is broken (point 1 above).

3. **NFTHive link shows "An error occurred on client"** for premint drops that haven't been finalized through NFTHive's creator tool. The user wants the button hidden for these drops.

4. **`fetchDropById` has the same broken pools lookup** for the detail page.

5. **Badge ref warning** in console from `MyDrops` — `Badge` is a function component used inside `TabsTrigger` which tries to pass a ref.

### Plan

**File: `src/services/atomicApi.ts`**

Replace the broken `pools` table lookup in both `fetchUserDrops` and `fetchDropById` with a reliable AtomicAssets API query:

- Query: `GET /atomicassets/v1/assets?owner=nfthivedrops&collection_name={collectionName}&limit=1`
- This finds any asset deposited into the drop contract for that collection
- Extract image from `data.img` / `data.image` / `immutable_data.img` / `immutable_data.image`
- Apply `getImageUrl()` to normalize IPFS hashes

In `fetchUserDrops`:
- Replace lines 798-831 (the `pools` table block) with the AtomicAssets API query
- Keep the `isPremint` detection as-is (it works correctly for `assets_to_mint: []`)

In `fetchDropById`:
- Replace lines 504-533 (the premint fallback block) with the same AtomicAssets API approach

**File: `src/components/drops/MyDrops.tsx`**

- Add `isPremint` field to the drop data (derived from `assets_to_mint` being empty in `fetchUserDrops`)
- Conditionally hide the "View on NFT Hive" button when the drop is premint (since NFTHive shows errors for unfinished premint drops)
- Fix the Badge ref warning by removing `Badge` from inside `TabsTrigger` children (wrap count in a `<span>` instead)

**File: `src/services/atomicApi.ts` (fetchUserDrops return type)**

- Add `isPremint: boolean` to the return type so `MyDrops` can conditionally hide the button

### Summary of changes
- 2 files modified: `src/services/atomicApi.ts`, `src/components/drops/MyDrops.tsx`
- Replace broken pools table query with working AtomicAssets API query for premint images
- Hide NFTHive button for premint drops
- Fix Badge ref console warning

