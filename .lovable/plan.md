

## Add Collection and Schema Filtering to CHEESEDrop

### Problem
The CHEESE tab shows all drops from various collections with no way to filter. Users want to narrow by collection and optionally by schema within a collection.

### How it works
A dropdown filter bar appears above the drop grids (on both Official and CHEESE tabs). Selecting a collection reveals a second dropdown for schema filtering. Selecting just a collection shows all drops from that collection; selecting a schema narrows further.

### Data gap
The `NFTDrop` type and `rawDropToNFTDrop` don't include schema info. The on-chain `nfthivedrops` table doesn't store schema names, but the AtomicAssets template API response does (at `data.schema.schema_name`). We need to propagate this through enrichment.

### Changes

**1. `src/types/drop.ts`** — Add `schemaName?: string` to `NFTDrop` interface.

**2. `src/services/atomicApi.ts`** — Update `fetchTemplateById` to also return `schemaName` from `template.schema.schema_name`. Update `fetchTemplatesBatch` similarly.

**3. `src/hooks/useEnrichDrops.ts`** — When enriching drops with template data, also set `schemaName` on the enriched drop from the template response.

**4. `src/pages/Drops.tsx`** — Add filter state (`selectedCollection`, `selectedSchema`). Extract unique collections and schemas from the current tab's drops. Render a filter row with:
- A collection dropdown (all unique collection names from the tab's drops)
- When a collection is selected, a schema dropdown appears showing schemas available in that collection
- A clear/reset button
- Apply filters to the displayed drops before passing to `SimpleDropGrid`

### UX details
- Both dropdowns use the existing `DropdownMenu` component
- "All Collections" and "All Schemas" as default options
- Filter state resets when switching tabs
- Collection dropdown shows count of drops per collection
- Schema dropdown only appears when a collection is selected (hover-based submenu or sequential dropdown)

### Files changed: 4
- `src/types/drop.ts`
- `src/services/atomicApi.ts`
- `src/hooks/useEnrichDrops.ts`
- `src/pages/Drops.tsx`

