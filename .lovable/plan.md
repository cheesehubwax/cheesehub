# CHEESELytics — selectable metric chart for the pool detail panel

## What changes

The pool detail panel (below the pool table) currently shows four small charts side by side.
It will work like the main overview instead: the four stat boxes become selectors, and one
chart beneath shows the chosen metric's history for the selected pool.

- **USD value** — default
- **CHEESE in pool**
- **Paired token in pool** (label uses the pool's symbol, e.g. WAX, HOLE)
- **Accounts** (providers in the pool)

## Changes — all in `src/components/lytics/LyticsPoolDetail.tsx`

1. Turn the four stat boxes into buttons with a selected highlight (same style as the
   overview). Default selection: USD value. Selection resets to USD when a different pool
   is selected.
2. Replace the 2x2 grid of four mini charts with a single chart that plots the selected
   metric across the recorded days for that pool. USD keeps the filled area style; other
   metrics use the same area chart with per-metric formatting for axis and tooltip.
3. Show the chart from the very first snapshot (dots on the line, like the overview) —
   the "two days needed" message goes away; keep a message only for zero recorded days.
4. Keep the existing "Pool history CSV" button, provider table, and all other content
   unchanged. The paired-token tooltip keeps its higher-precision formatting.

## Verification

- With the one existing snapshot: selecting each box swaps the chart, axis formatting and
  tooltip correctly; single day renders as a dot.
- `bunx tsgo --noEmit` and the production build pass.
