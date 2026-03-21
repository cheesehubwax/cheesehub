
Issue summary

Your clue is very useful: if NFTHive says the premint drop does not exist when using our button, that strongly suggests CheeseHub is linking to the wrong NFTHive URL format for at least some drops. I also found a likely separate issue in our image fallback path for premint drops.

What I found

1. Wrong NFTHive link format in My Drops
- `src/components/drops/MyDrops.tsx` currently links to:
  `https://nfthive.io/drop/${drop.dropId}`
- Web results show many NFTHive premint drops use:
  `https://nfthive.io/drop/nfthivedrops/${dropId}`
- That matches your symptom exactly: the button can point to a non-existent page even though the on-chain drop exists.

2. Premint image fallback is probably reading the wrong on-chain source
- `src/services/atomicApi.ts` fetches premint images in `fetchUserDrops()` by:
  - detecting premint via empty `assets_to_mint` / template `-1`
  - querying `nfthivedrops` table `pools`
  - trying to read `rows[0].assets[0]`
- This is fragile and likely wrong for your created premint drops:
  - the row shape may not actually expose the deposited asset IDs in `assets`
  - the lookup may need a different key/scope/path than the current `lower_bound/upper_bound = drop_id`
- Result: the fallback never finds a real asset image, so the card stays on placeholder/blank.

3. There is also inconsistent image handling between list views
- `MyDrops.tsx` uses a simple local `getImageUrl()` with only `http`, `Qm`, and `bafy`
- The app already has a more complete shared resolver in `src/services/atomicApi.ts` that also supports:
  - `ipfs://`
  - `bafk`
  - `/ipfs/...`
  - long CID-like values
- Even if an image is found, My Drops can still fail to render some valid asset URLs.

4. Detail-page enrichment likely misses premint too
- `fetchDropById()` enriches only when `templateId` exists.
- Premint drops do not have a usable template ID, so the detail page will also remain image-less unless we add an asset-based fallback there too.

Implementation plan

1. Fix NFTHive links for user-created drops
- Update My Drops “View on NFT Hive” button to use the contract-qualified path:
  `https://nfthive.io/drop/nfthivedrops/${drop.dropId}`
- Review any other NFTHive drop links in the app and normalize them where appropriate.

2. Centralize premint drop URL generation
- Add a small helper in the drop service or a shared utility to generate NFTHive drop URLs from a drop ID/source.
- Use that helper in My Drops and anywhere else we expose external drop links, so this doesn’t regress.

3. Replace the premint image fallback with a more reliable asset-resolution path
- Refactor `fetchUserDrops()` in `src/services/atomicApi.ts` so premint drops resolve their preview image from deposited/associated asset data more robustly.
- Preferred approach:
  - inspect the actual on-chain row shape used for premint storage
  - resolve a real deposited asset ID from the correct table/field
  - fetch AtomicAssets metadata for that asset
  - extract image from `data.img`, `data.image`, `immutable_data.img`, or `immutable_data.image`
- Keep the current template-based enrichment for mint-on-demand drops unchanged.

4. Add the same premint image fallback to single-drop loading
- Extend `fetchDropById()` so premint drops can resolve an image the same way My Drops does.
- This keeps `/drops/:id` consistent with My Drops and avoids “blank in details but not in list” behavior.

5. Reuse the shared image URL resolver in My Drops
- Remove the limited local `getImageUrl()` in `src/components/drops/MyDrops.tsx`
- Reuse the shared resolver already used elsewhere so IPFS/image variants render consistently.

6. Tighten fallback behavior so blank images degrade gracefully
- If no asset image can be found, explicitly show the placeholder SVG rather than ending up with a white/empty render.
- If the drop is premint and has no external NFTHive page yet, consider disabling or softening the external button state later, but first fix the URL and asset lookup.

Files I would update

- `src/components/drops/MyDrops.tsx`
  - fix NFTHive link
  - reuse shared image URL helper
- `src/services/atomicApi.ts`
  - improve premint asset/image resolution in `fetchUserDrops()`
  - add matching fallback to `fetchDropById()`
  - optionally add shared helper for NFTHive drop URLs

Technical notes

```text
Current failure path
premint drop created
  -> fetchUserDrops finds on-chain row
  -> premint detected
  -> pools lookup does not produce usable asset id
  -> image remains placeholder/blank
  -> My Drops link points to /drop/{id}
  -> NFTHive says drop does not exist

Proposed path
premint drop created
  -> fetchUserDrops finds on-chain row
  -> resolve correct deposited asset id from on-chain storage
  -> fetch AtomicAssets metadata for that asset
  -> normalize image via shared getImageUrl()
  -> My Drops card renders correctly
  -> external button uses /drop/nfthivedrops/{id}
```

Expected outcome

- Your premint drop should appear in My Drops with a real image instead of a blank tile.
- The NFTHive button should open the correct drop page format for premint drops.
- The drop detail page should also be able to show the premint image consistently.

Open question I do not need blocked on
- If NFTHive truly has not indexed that premint drop yet, CheeseHub should still be able to show the image from on-chain + AtomicAssets metadata as long as the deposited asset IDs are available. So the NFTHive “does not exist” message does not prevent us from fixing the CheeseHub blank image.
