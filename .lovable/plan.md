# CHEESEAnal — value boxes show last recorded snapshot

## Problem
The value boxes (CHEESE Overview boxes, pool-history boxes, account-detail boxes) are fed by a **live** read of the exchanges that refetches every 5 minutes, while the graphs are built from **recorded snapshots** taken twice daily. So the boxes can disagree with the last (rightmost) graph point.

## Fix
Make the value boxes use the most recent **recorded snapshot** — the same data as the last graph point — so boxes and graphs always agree.

- In `src/pages/CheeseAnal.tsx`, source `current` from the latest recorded day (`days[last].date` via `useLpDay`) instead of the live read.
  - Keep the live read only as a fallback when no snapshot history exists yet (e.g. fresh data branch), and for the "live data unavailable" error banner.
- Show the snapshot's date/time next to the values (e.g. "as of 13:41 UTC snapshot") so it's clear the figures are from the last run, not real-time.
- Pool list, venue filter, account holdings, CSV export, and value boxes all stay consistent because they already derive from `current`.
- No workflow or data-format changes; stored snapshots are untouched.

## Notes
- Values will update only when a new snapshot is recorded (twice daily), matching the graphs exactly.
