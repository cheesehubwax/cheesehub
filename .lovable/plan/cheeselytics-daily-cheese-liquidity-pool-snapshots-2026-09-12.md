# CHEESELytics — daily CHEESE liquidity pool snapshots

Record every CHEESE liquidity pool on Alcor once a day, keep the history, and show it on a new
page called CHEESELytics with charts for whole pools and for individual accounts.

## Pools tracked

CHEESE/WAX, CHEESE/WAXUSDC, CHEESE/WAXWBTC, CHEESE/HOLE, CHEESE/LSWAX, CHEESE/LSW,
CHEESE/WAXWETH. Each pair is matched by its two tokens, so every fee tier of that pair is
included automatically and new tiers get picked up without a code change.

## What each daily snapshot stores

Per pool:
- Total value in USD, CHEESE held in the pool, paired-token held in the pool
- Number of accounts providing liquidity, number of open positions
- Current CHEESE price used for the day

Per account (every account, no cut-off):
- Position value in USD, CHEESE in the position, paired-token in the position
- Number of positions and how many are in range

## How it runs

A scheduled GitHub Actions run once a day (with a couple of extra ticks in the same day as a
safety net, recording only if that day has no snapshot yet, exactly like the RAM price history).
Results are written to a separate data-only branch in the repo, so nothing is needed from a
backend and the live GitHub site can read it. A manual "run now" button is available in Actions,
including a force option.

Each day is written as its own file so the history stays small to load, plus a summary index of
pool-level totals per day for fast charting.

## CHEESELytics page

New page at `/cheeselytics`, reachable by URL only — no header or menu link added yet.

Layout, in CheeseHub style:
- Overview row: combined CHEESE liquidity across all pools in USD, total CHEESE in pools, total
  provider accounts, with a chart of the combined value over time
- Pool table: each pair with current USD value, CHEESE amount, paired-token amount, account
  count, and the change since the previous day
- Pool detail: pick a pool to see its value / CHEESE / paired-token / account-count charts over
  the selected range and its ranked provider list for the latest day
- Account drill-down: pick an account (from a pool list or by typing a name) to see that
  account's position value, CHEESE, and paired-token over time, across every pool it appears in
- Range switch (7D / 30D / 90D / ALL), same style as the CHEESERam charts
- CSV download of the latest snapshot and of a selected account's history
- Clear message when the day's snapshot has not been recorded yet, instead of showing zeros

## Technical notes

- Sampler `scripts/lp-history/sample.ts` (Bun, mirrors `scripts/ram-price-history/sample.ts`):
  resolves the configured pairs from `GET /api/v2/swap/pools`, then reads
  `GET /api/v2/swap/pools/{poolId}/positions` per pool id, keeping open positions with non-zero
  liquidity (in range and out of range), using each position's current `totalValue` for USD —
  the same basis as the CHEESEAir LP fix — and its per-token amounts for the CHEESE and paired
  token columns. Retries and per-request timeouts; the run aborts without committing if any
  configured pool fails, so partial days are never stored as real data.
- Pool list lives in one shared constant so the app and the sampler agree.
- Workflow `.github/workflows/lp-history.yml`: daily crons + `workflow_dispatch`, concurrency
  group, `contents: write`, clones/creates orphan branch `lp-history-data`, runs the sampler,
  commits only on change.
- Storage on `lp-history-data`: `data/lp-history-index.json` (pool totals per day, capped at
  ~2 years) and `data/days/YYYY-MM-DD.json` (full per-account rows for that day).
- Reader hook `src/hooks/useLpHistory.ts`: same raw.githubusercontent pattern and owner
  derivation as `useRamPriceHistory.ts`, `@tanstack/react-query` cached, index loaded eagerly
  and day files lazily; reuses `downsample` for charts.
- Page `src/pages/CheeseLytics.tsx` plus components under `src/components/lytics/`, route added
  in `App.tsx` with no nav entry; charts via the existing Recharts setup; OpenMoji icons and
  existing card/tab styling.
- Tests for the sampler's aggregation and the reader's parsing/day-selection logic.
