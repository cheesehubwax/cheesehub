# CHEESELytics — make the pool detail charts show from the first snapshot

## Problem

The pool detail panel keeps its existing four small charts (USD value, CHEESE in pool,
paired token, accounts). But they only render once two days are recorded, so with the
current single snapshot the user sees "Charts appear once at least two days have been
recorded" and no charts at all.

## Changes — all in `src/components/lytics/LyticsPoolDetail.tsx`

1. Lower the chart gate from 2+ days to 1+ day so the four charts appear immediately.
2. Enable point dots on all four charts' lines/areas so a single snapshot renders as a
   visible dot (mirrors the overview chart behavior).
3. Keep a message only for the zero-days case ("Charts appear once a snapshot has been
   recorded").
4. Everything else — stat boxes, provider table, CSV button, chart styling — stays as is.

## Verification

- With the one existing snapshot, selecting a pool shows all four charts, each with a dot.
- `bunx tsgo --noEmit` and the production build pass.
