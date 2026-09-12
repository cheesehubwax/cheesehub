# CHEESELytics — clickable overview stats that drive the chart

## What the user wants

In the CHEESE liquidity overview card, the four stat boxes become selectors. Tapping one
highlights it and the chart below switches to that metric's history:

- **Total liquidity** (USD) — default
- **CHEESE in pools**
- **Providers**
- **Positions**

And the chart should start drawing from the very first snapshot instead of waiting for two.

## Feasibility (confirmed)

The daily index file already records `usd`, `cheese`, `accounts` and `positions` per pool
per day, so all four metrics can be summed across pools for every recorded day — no sampler
or workflow changes needed.

## Changes — all in `src/components/lytics/LyticsOverview.tsx`

1. Turn the four stat boxes into buttons with a `selected` state: the active box gets a
   highlighted border/background; default selection is "Total liquidity".
2. Extend the chart series to carry all four metrics per day (sum of that metric across the
   day's pools) and plot whichever metric is selected.
3. Per-metric formatting:
   - USD → `$1,234` style via `usd()`
   - CHEESE → plain amount
   - Providers / Positions → whole numbers
   Applied to the Y-axis ticks and the tooltip; tooltip label names the metric.
4. Lower the chart gate from "2+ days" to "1+ day": enable point dots on the line so a
   single snapshot renders as a visible dot instead of an invisible one-point area. Keep
   the "no snapshots yet / loading" message for zero days.
5. Keep the "vs previous day" delta only for the USD metric when 2+ days exist (or extend it
   to follow the selected metric — small addition, same helper).

## Verification

- With the one existing snapshot: chart shows a single dot, switching boxes swaps the
  tooltip/axis formatting correctly.
- `bunx tsgo --noEmit` and the production build pass.
