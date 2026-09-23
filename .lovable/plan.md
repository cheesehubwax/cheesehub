# CHEESEAnal — click a mini graph to open a large zoomable version

As recorded history grows, the small graphs squeeze more points into the same width and become hard to read. This adds a click-to-enlarge popup for every mini graph, with a larger chart, finer detail and a time-range zoom.

## What you will see

- Every mini graph on the pool history panel (all six: price in pair, pool value, CHEESE in pool, paired token, provider accounts, 24h volume) and the account detail panel (position value, CHEESE in positions) becomes clickable, with a subtle hover hint (cursor plus a faint "click to enlarge" affordance on hover).
- Clicking opens a centred popup showing that same graph at the same size as the big overview graph at the top of the page (same height, full container width), titled with the same heading as the mini graph.

- The large graph keeps the same colours, dots and the same rich tooltip as the mini version — hovering still shows the value, the change since the previous snapshot, WAX equivalents, provider joins/leaves and per-pool changes exactly as today.
- A drag-to-zoom strip along the bottom of the large graph lets you pull a window over any span of dates and drag it, so dense later history can be examined day by day; a reset button restores the full range.
- The popup closes with the X, the Escape key, or clicking the dimmed backdrop.
- Nothing else changes: mini graph sizes, colours, value boxes, ordering, filtering and all figures stay identical.

## Technical details

- New shared `AnalChartDialog.tsx` in `src/components/anal/`: a shadcn `Dialog` (component already exists in `src/components/ui/dialog.tsx`) rendering the chart at the overview's `h-96` height with the same axis/grid/dot styling, plus `Brush` (recharts, already in use) for range zoom, reusing `MiniChartTooltip` and the existing `extras` builders unchanged.
- In `AnalPoolDetail.tsx` and `AnalAccountPanel.tsx`, wrap each `h-36` chart container in a button/click target that opens the dialog with that chart's series, dataKey, formatter, colour, chart type (Line vs Area) and tooltip extras. The dialog owns its own hover state so account-attribution lookups (`useLpDay`) keep working inside the popup via the existing query cache.
- The dialog chart reuses the same memoised series data — no extra network requests beyond the already-cached hover lookups.
- Overview chart in `AnalOverview.tsx` is already large (full-width, h-96) and out of scope; only the eight mini graphs get the popup.
- Empty/loading states stay as-is and are not clickable.

## Verification

- Focused tests where practical; then browser-check on /anal: click several mini graphs (price, value, providers, volume; account panel with a real account), confirm the large graph matches the mini one, tooltips show full detail, brush zoom works, and the popup closes by X/Escape/backdrop.
- Confirm typecheck, full test suite and build are clean.
