# Fix RAM price history: missed schedule + empty history chart

## What I verified

- The data branch is healthy: `ram-price-data/data/ram-price-history.json` currently holds **exactly 2 samples** — 02:38 UTC and 08:42 UTC today (both from your two manual runs).
- The GitHub API shows the RAM Price History workflow has **only `workflow_dispatch` runs — zero `schedule` runs**. The workflow file landed on `main` at 02:31 UTC, so the 04:07 and 08:07 ticks were dropped by GitHub's scheduler (the workflow itself is `active`, and the powerup workflow's crons in the same repo do fire, so cron works here in general).
- The chart panel only draws when it has **2 or more points** (`hasChart = chartData.length >= 2`). At the time you clicked 24H there was only one recorded sample, so every history tab correctly-but-uselessly fell back to "Collecting history". Loaded against the current 2-sample file in a browser here, 24H/7D/30D/ALL all render fine.

So: problem 1 is a real scheduling reliability issue; problem 2 was a single-sample edge case plus a stale query window, not a broken fetch.

## Fix 1 — make the sampler actually fire on time

GitHub's shared cron queue silently drops ticks on busy minutes; the repo already handles this for the powerup job by firing a cluster of ticks and guarding for idempotency. Do the same here.

- `.github/workflows/ram-price-history.yml`: replace the single `cron: "7 */4 * * *"` with a set of staggered ticks every 2 hours on an off-peak minute (e.g. `"23 1-23/2 * * *"`), so a dropped tick is retried within 2 hours instead of 4.
- `scripts/ram-price-history/sample.ts`: raise the skip guard from 2h to **3.5h** (`MIN_GAP_MS`). Combined with 2-hourly ticks this keeps the recorded cadence at roughly 4 hours while letting a late tick catch up. The skip path already exits 0 and commits nothing, so extra ticks are free no-ops.
- Keep `workflow_dispatch` with the existing `force` input for manual top-ups.
- Update `scripts/ram-price-history/README.md` to describe the new cadence and guard.

## Fix 2 — make the chart usable from the very first sample

`src/components/ram/RamPricePanel.tsx`:
- When a history range has exactly **one** point, synthesise a second point at the same values (timestamp = now) so a flat line renders instead of the empty state. Recharts needs two points to draw an area.
- Distinguish the empty states instead of one generic string:
  - loading → "Loading history..."
  - fetch failed → "History unavailable — showing LIVE" (with the LIVE tab still fully working)
  - zero samples in that window but samples exist outside it → "No samples in this range yet — try ALL"
  - genuinely zero samples → "Collecting history — first sample recorded every 4 hours"

`src/hooks/useRamPriceHistory.ts`:
- Drop the 10-minute `staleTime` to 2 minutes and refetch on window focus / on mount, so a freshly committed sample shows up when you come back to the page rather than up to 30 minutes later.
- Keep the existing 10-minute cache-buster bucket and the sort/validate filter.

No changes to buy/sell logic, the contract calls, or the LIVE sparkline behaviour.

## Verification

- Run the sampler locally against a temp file with `FORCE=1` and confirm it still appends a valid record and that a second immediate run is skipped by the 3.5h guard.
- Build passes; on `/ram`, LIVE is unchanged and 24H / 7D / 30D / ALL all render against the current 2-sample file (checked in-browser).
- After you push, the first natural tick should appear in the Actions list within ~2 hours; if GitHub drops it, the next 2-hourly tick records the sample.
