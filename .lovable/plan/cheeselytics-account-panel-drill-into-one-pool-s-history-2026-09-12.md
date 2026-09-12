# CHEESELytics account panel: drill into one pool's history

## Goal
In the Account detail panel, make each pool row in the holdings table clickable. Clicking a pool filters the two history charts (Position value USD, CHEESE in positions) to just that pool for the selected account. With no pool selected (the default), the charts show the combined totals across all pools exactly as they do now.

## Changes

### `src/components/lytics/LyticsAccountPanel.tsx`
- Add local state `selectedPool: string | null` (pool `label`), reset when the account changes or is cleared.
- Make rows in the holdings table clickable (`button`-style row, cursor-pointer, hover highlight); clicking a row selects that pool, clicking it again (or a "Show all" affordance) deselects back to the combined view.
- Visually highlight the selected row (cheese accent background/border) so it is clear the charts are filtered.
- Chart data derivation:
  - No pool selected: keep current behaviour — sum `usd`/`cheese` across all pools per date.
  - Pool selected: filter `rows` to that `poolKey`/`label` before bucketing by date, so both charts show that pool only.
- Update the chart section labels to reflect the filter, e.g. "Position value (USD) — CHEESE/WAX" when filtered, and show a small "Showing: All pools / CHEESE-WAX ×" chip near the charts to clear the filter.
- CSV export button stays as-is (full account history) unless a pool is selected, in which case export only that pool's rows and name the file accordingly (e.g. `cheeselytics-<account>-<pool>.csv`).

## Notes
- No changes to data fetching — `useLpAccountHistory` already returns per-pool rows (`poolKey`, `label`) for every recorded day; this is purely a display filter.
- Selection resets when the account is cleared or changed, and when the underlying holding disappears.
- The holdings table already lists every pool the account is in, which becomes the natural picker.

## Verification
- Typecheck + build.
- Load `/cheeselytics` in the preview, look up an account with positions in multiple pools, confirm: default charts match combined totals; clicking a pool row filters both charts and highlights the row; clicking again / clearing restores the combined view; CSV respects the filter.
