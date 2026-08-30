# RAM price history: reliable twice-daily sampling

## What I verified

- The data branch is healthy: `ram-price-data/data/ram-price-history.json` holds the 2 samples from your manual runs (02:38 and 08:42 UTC today), and the chart now renders them.
- The GitHub API shows the RAM Price History workflow has **only `workflow_dispatch` runs — zero `schedule` runs**. The workflow landed on `main` at 02:31 UTC, so the 04:07 and 08:07 ticks were dropped by GitHub's shared cron queue. The workflow is `active` and the powerup workflow's crons in the same repo do fire, so cron works here in general — the single 4-hourly tick just isn't reliable.

## Plan: sample twice a day, with catch-up ticks

Two samples per day (roughly 00:00 and 12:00 UTC) is plenty to build a day-to-day price history, and each run costs a single tiny commit.

`.github/workflows/ram-price-history.yml`
- Replace `cron: "7 */4 * * *"` with a cluster of ticks around each target time, mirroring the pattern the powerup workflow already uses for dropped-tick resilience:
  - `"23 0 * * *"` and `"23 2 * * *"` (primary + catch-up for the 00:00 sample)
  - `"23 12 * * *"` and `"23 14 * * *"` (primary + catch-up for the 12:00 sample)
- Off-peak minute `:23` instead of `:07`, which is one of the most contended minutes on GitHub's scheduler.
- Keep `workflow_dispatch` with the `force` input for manual top-ups.

`scripts/ram-price-history/sample.ts`
- Raise the skip guard `MIN_GAP_MS` from 2h to **10h**, so a catch-up tick records the sample only if the primary tick was actually dropped. The skip path already exits 0 and commits nothing, so extra ticks are free no-ops.
- Lower `MAX_RECORDS` from 4400 to **1600** (~2 years at 2 samples/day) so the file stays small.

Wording updates (cosmetic, so the UI matches reality)
- `src/components/ram/RamPricePanel.tsx`: footer and empty-state text change from "every 4 hours" to "twice daily" — e.g. `Recorded twice daily since 30 Aug 2026`.
- `scripts/ram-price-history/README.md` and the workflow comments: describe the twice-daily cadence and the 10h guard.

No changes to chart rendering, the LIVE sparkline, the range tabs, the fetch hook, or any buy/sell/contract logic.

## Verification

- Run the sampler locally against a temp file: first run with `FORCE=1` appends a record; an immediate second run without `FORCE` is skipped by the 10h guard.
- Build passes and `/ram` still renders LIVE plus the history ranges, with the updated "twice daily" footer.
- After you push, the next primary tick (00:23 or 12:23 UTC) should show as a `schedule` run in Actions; if GitHub drops it, the 02:23 / 14:23 tick records the sample instead.
