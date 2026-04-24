## Add Subcategories to Official Tab on CHEESEDrop

### What Changes

Inside the existing **Official** tab on `/drops`, add two sub-filters that split `cheesenftwax` collection drops by their schema:

- **Collectibles** — drops whose template belongs to the `collectibles` schema (default selected, contains all current drops)
- **Account Names** — drops whose template belongs to the `accountnames` schema

The other top-level tabs (CHEESE, My Drops, Create) remain untouched.

### How It Works

Each `NFTDrop` already carries a `schemaName` field that gets populated during template enrichment in `useEnrichDrops` / `atomicApi`. We just filter `enrichedOfficialDrops` by `schemaName` to produce the two sub-lists.

If `schemaName` hasn't been enriched yet for a drop (still loading), it falls into the default Collectibles bucket so the UI doesn't appear empty during enrichment.

### UI

A small secondary `Tabs` row sits directly under the "Official CHEESE Drops" heading, styled like the existing tab list but smaller — same `bg-card/80 border border-border/50` look. Each sub-tab shows a count badge of how many drops are in it.

```text
[⭐ Official] [🧀 CHEESE] [📂 My Drops] [✍️ Create]   [↻]
─────────────────────────────────────────────────────
Official CHEESE Drops
Drops from the official cheesenftwax collection

  [ 🖼️ Collectibles (N) ] [ 👤 Account Names (M) ]

  <SimpleDropGrid drops={...} />
```

### File Changes

- **`src/pages/Drops.tsx`** — inside `<TabsContent value="official">`:
  - Add `useState` for the active sub-category (`'collectibles' | 'accountnames'`, default `'collectibles'`)
  - Derive `collectiblesDrops` and `accountnamesDrops` from `enrichedOfficialDrops` by checking `drop.schemaName`:
    - `accountnames` → `schemaName === 'accountnames'`
    - `collectibles` → everything else (covers `collectibles` schema + any drops still awaiting enrichment)
  - Render a nested `Tabs` (or a simple button group) with the two sub-tabs
  - Pass the filtered list to `<SimpleDropGrid />`
  - Empty-state copy adjusts per sub-tab ("No active collectibles drops" / "No account name drops available")

### Notes / Assumptions

- Schema names assumed to be exactly `collectibles` and `accountnames` (lowercase) as they appear on-chain in the `cheesenftwax` collection. If the actual schema slug differs, we adjust the string after the first render shows the wrong split.
- No data-layer changes required — `schemaName` is already fetched.
- Ordering within each sub-tab keeps the existing `dropId` ascending sort.