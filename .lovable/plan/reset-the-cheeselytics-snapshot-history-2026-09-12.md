# Reset the CHEESELytics snapshot history

## Goal

Discard the one snapshot recorded before the providers-count fix, so the charts start clean from the next snapshot and the Providers graph never shows a fake day-one drop (172 → 64).

## What happens

1. On the `lp-history-data` branch:
   - Remove the existing day entry from `data/lp-history-index.json` (leaving `days: []`).
   - Delete the matching `data/days/<date>.json` file.
   - Commit and push the branch.
2. You then record the first clean snapshot by running the **LP History** workflow manually from the repo's Actions tab (or letting the next scheduled daily run do it).

## Result

- The site returns to the "No snapshots recorded yet" state with live figures in the boxes.
- Every new snapshot stores the deduplicated providers figure, so the box and the graph always agree.

## Technical details

- Files touched: only the `lp-history-data` branch (`data/lp-history-index.json`, `data/days/*.json`) — no app code changes.
- Steps performed locally: clone the data branch, edit the two paths, push back to `origin/lp-history-data`.
- The workflow and sampler already handle an empty index, so no code changes are needed.

## Verification

- Confirm the index on the branch shows zero days.
- Load `/cheeselytics` and confirm the "No snapshots recorded yet" state renders.
