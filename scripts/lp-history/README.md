# CHEESELytics LP history sampler

Records one snapshot per UTC day of every tracked CHEESE liquidity pool on Alcor
(all fee tiers), including a row per provider account.

- Pool list: `src/lib/lpPools.ts` (`TRACKED_LP_PAIRS`) — shared with the app.
- Runner: `.github/workflows/lp-history.yml` (daily crons + manual dispatch).
- Output branch: `lp-history-data`
  - `data/lp-history-index.json` — pool totals per day (charts read this)
  - `data/days/YYYY-MM-DD.json` — full per-account rows for that day

Local run:

```sh
mkdir -p /tmp/lp-data/days
LP_HISTORY_DIR=/tmp/lp-data bun run sample.ts
```

The run aborts without writing anything if a tracked pool cannot be read, so a
partial day is never stored as real data. `FORCE=1` re-records the current day.
