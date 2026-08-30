# Historical RAM Price Tracking (CHEESERam)

## Goal

Start recording the WAX RAM price (and its CHEESE equivalent) every 4 hours from now on, store the samples in the repo via GitHub Actions, and let the CHEESERam price panel show day-to-day history through range tabs.

## How it works

```text
GitHub Actions (cron, every 4h)
  -> read eosio::rammarket (WAX per byte)
  -> read Alcor CHEESE/WAX + WAXUSDC rates
  -> append one sample to data/ram-price-history.json
  -> commit to a dedicated `ram-price-data` branch

CHEESERam page
  -> fetches that JSON from raw.githubusercontent.com
  -> renders 24H / 7D / 30D / ALL history, or the existing LIVE session sparklines
```

Committing to a data-only branch (not `main`) is deliberate: it keeps the every-4-hour commits from retriggering the Pages deploy workflow, and the site always reads the newest samples without waiting for a rebuild.

Note: history starts empty. The chart will show "Collecting history..." for the first day or two, then fill in — roughly 6 samples/day, 42/week.

## What the user sees

- The Live RAM Price panel gains a small tab row: `LIVE | 24H | 7D | 30D | ALL`.
- `LIVE` is the current session sparkline behaviour (unchanged, 30s refresh).
- The history ranges plot the recorded samples for both series, keeping the existing two stacked charts: white WAX/KB on top, yellow CHEESE/KB below.
- Tooltips on history ranges show the sample date/time plus the value.
- Footer note switches from "Session data only" to e.g. "Recorded every 4 hours since 29 Aug 2026" when a history range is active.

## Technical plan

### 1. Sampler script — `scripts/ram-price-history/`

New Bun script, mirroring the layout and conventions of `scripts/daily-powerup/` (own `package.json`, `tsconfig.json`, `README.md`).

- `waxRpc.ts`-style multi-endpoint fallback list reused from the same endpoints as `src/lib/cheeseRam.ts` (greymass / eosusa / waxsweden / eosphere).
- Reads `eosio::rammarket` → `waxPerByte = quote.balance / base.balance`.
- Reads `https://wax.alcor.exchange/api/v2/tokens` → `CHEESE@cheeseburger.system_price` (WAX per CHEESE) and `WAXUSDC@eth.token.system_price`, matching the derivation already in `useCheesePriceData`.
- Appends one record:
  ```json
  { "t": 1756468800000, "waxPerKb": 0.00768123, "cheesePerKb": 1.9249, "waxPerCheese": 0.0039, "usdPerKb": 0.00021 }
  ```
- Idempotency/robustness: skip the append if the last record is under 2 hours old; abort without committing if either fetch fails, so a bad sample never poisons the series.
- File is kept sorted ascending and capped at ~4400 records (~2 years at 6/day) to bound size.

### 2. Workflow — `.github/workflows/ram-price-history.yml`

- `on: schedule: cron "7 */4 * * *"` plus `workflow_dispatch`.
- `permissions: contents: write`, `concurrency: ram-price-history`.
- Checks out the `ram-price-data` branch (creates it as an orphan branch on first run if absent), runs the script, commits `data/ram-price-history.json` with `github-actions[bot]`, pushes.

### 3. Frontend data hook — `src/hooks/useRamPriceHistory.ts`

- `useQuery` fetching `https://raw.githubusercontent.com/<owner>/<repo>/ram-price-data/data/ram-price-history.json` with a cache-busting `?t=<hour bucket>` param, `staleTime: 10 min`, `refetchInterval: 30 min`.
- Returns typed `RamHistoryPoint[]`, plus helpers to slice by range (24H/7D/30D/ALL) and to downsample long ranges to ~120 points for smooth rendering.
- Fails soft: on error the panel just falls back to the LIVE tab.

### 4. Panel — `src/components/ram/RamPricePanel.tsx`

- Add a `range` state (`'live' | '24h' | '7d' | '30d' | 'all'`) and a compact tab row styled like the existing centred tab bars used elsewhere on CHEESEHub.
- The two `AreaChart`s keep their current gradients, colours, decimals (8 for WAX/KB, 4 for CHEESE/KB) and per-chart `YAxis domain={['dataMin','dataMax']}`; only the data array and tooltip label change per range.
- History points reuse the same `waxPerKb` / `cheesePerKb` keys so no chart config changes are needed.
- Header values continue to show the current live prices regardless of the selected range.

No changes to `useCheeseRam.ts`, buy/sell logic, or contract interaction.

## Verification

- Run the sampler locally once and confirm it writes a valid record.
- Trigger the workflow manually (`workflow_dispatch`) and confirm the branch + JSON appear.
- Build passes; `/ram` shows the tab row, LIVE behaves exactly as today, and history tabs render once at least two samples exist.
