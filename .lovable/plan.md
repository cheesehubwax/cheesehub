# CHEESELytics — keep daily snapshots, final verification

## Decision

Alcor's API only returns the *current* state of each pool — there is no historical endpoint.
The daily GitHub Actions snapshot is the only way to get charts, trends, day-over-day
changes and per-account history. The user confirmed: **keep the daily snapshot job**.

No architecture change. This plan covers only the final checks before calling the work done.

## What already exists (no changes)

- `.github/workflows/lp-history.yml` — daily snapshot of all 7 tracked CHEESE pairs into the
  `lp-history-data` branch (index file + one file per day with every account's position).
- `scripts/lp-history/sample.ts` — the sampler; aborts without writing if any pair fails.
- `/cheeselytics` page — overview charts, pool table, pool detail, provider rankings,
  account drill-down, CSV downloads, live Alcor figures for "today".
- URL-only route; no header/menu link yet.

## Steps

1. Run the production build to confirm everything compiles cleanly.
2. Open `/cheeselytics` in the preview and verify the page renders: live pool totals load,
   pool table is populated, selecting a pool shows its provider list, and account lookup works.
3. Confirm the "no history yet" message shows correctly until the first daily snapshot lands.
4. Report results.

## Technical notes

- History appears from the first recorded day onward; until then the page falls back to live
  Alcor data for current figures and clearly says when no snapshot exists yet.
- The workflow can be triggered manually (Actions tab) with a force option to record today
  immediately instead of waiting for the cron tick.
