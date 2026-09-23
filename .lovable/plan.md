# Mini graphs: restore tooltips, constant "Click to enlarge" button

## Problem

`AnalChartCard` covers each compact chart with a full-size transparent button (absolute inset-0) that catches every mouse event. That is why the cursor shows the magnifying glass everywhere and why hovering a snapshot point no longer opens the tooltip — the tooltip hover events never reach the chart.

## Changes

- **src/components/anal/AnalChartCard.tsx**
  - Remove the full-chart overlay button and the hover-only "Click to enlarge" hint.
  - Add a small, always-visible button with the 🔍 emoji, labelled "Click to enlarge", placed under the compact chart (or in its top-right corner, non-overlapping). Clicking it opens the enlarged popup exactly as today.
  - The compact chart itself is no longer clickable and no longer shows the zoom cursor, so hover tooltips on snapshot points work again at the small size.
  - Everything else stays the same: enlarged popup at the big graph's size, drag-strip zoom, Reset zoom button, and all eight mini graphs (six pool, two account) use this card.

## Verification

- On /anal, hover a snapshot point on a mini graph: tooltip appears with the enriched detail.
- The "Click to enlarge" button is visible without hovering; clicking it opens the large chart.
- Typecheck, full test suite, build.
