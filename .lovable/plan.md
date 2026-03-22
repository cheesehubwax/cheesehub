

## Fix: Official drops displaying newest-first despite sort

### Root cause

In `useEnrichDrops.ts`, the hook initializes state with `useState(drops)` — this captures the initial `drops` prop at mount time. But the real issue is that **both the sorted input AND enriched output need to preserve order**. The `Promise.all` in the effect does preserve order, but there's a timing issue: the initial state may reflect an earlier unsorted array before the effect runs.

More likely, the `id` field values may be string-based and `Number()` conversion might not work as expected, or the data source returns them in a different order that overrides sorting.

### Fix

**`src/pages/Drops.tsx`** — Apply the sort to `enrichedOfficialDrops` right before rendering instead of (or in addition to) sorting in the `useMemo`. This ensures the final displayed array is always oldest-first regardless of what `useEnrichDrops` does:

- Wrap the render call: `<SimpleDropGrid drops={[...enrichedOfficialDrops].sort((a, b) => Number(a.id) - Number(b.id))} />`
- Do the same for `enrichedCheeseDrops` if desired

### Files changed
1. `src/pages/Drops.tsx` — sort enriched arrays at render time (2 lines)

