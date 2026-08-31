# RAM price history sampler

Records the WAX RAM price (and its CHEESE / USD equivalents) twice a day so
CHEESERam can chart day-to-day history.

- `sample.ts` — reads `eosio::rammarket` (multi-endpoint fallback) plus the Alcor
  `CHEESE/WAX` and `WAXUSDC` rates, then appends one record to the JSON file
  named by `RAM_HISTORY_FILE`.
- Data lives on the dedicated `ram-price-data` branch at
  `data/ram-price-history.json`. Keeping it off `main` means the sample commits
  never retrigger the GitHub Pages deploy, and the site reads fresh samples
  without a rebuild.
- The frontend fetches that file directly from `raw.githubusercontent.com`
  (see `src/hooks/useRamPriceHistory.ts`).

## Record shape

```json
{ "t": 1756468800000, "waxPerKb": 0.00768123, "cheesePerKb": 1.9249, "waxPerCheese": 0.0039, "usdPerKb": 0.00021 }
```

`t` is epoch milliseconds. The file is a JSON array sorted ascending by `t` and
capped at 1600 records (~2 years at two samples per day).

## Run locally

```bash
cd scripts/ram-price-history
RAM_HISTORY_FILE=/tmp/ram-price-history.json bun run sample.ts
```

Set `FORCE=1` to record even when the current slot already has a sample.

Both the RPC read and the Alcor read must succeed — on any failure the script
exits non-zero and writes nothing, so a partial sample never enters the series.

## Slot rule

The UTC day is split into two 12h slots: `00:00-11:59` and `12:00-23:59`. On
each run the sampler resolves the slot it lands in and records only when that
slot holds no sample yet. This replaces the older "skip if the newest record is
under 10 hours old" rule, which measured from the last recorded sample and so
let a manual run plus a delayed cron tick suppress a whole day of samples.

Consequences:

- A tick delayed by hours still records, as long as its slot is empty.
- A manual run fills only its own slot; the next scheduled slot still records.
- Repeat ticks inside a filled slot are no-ops, keeping two points per day.

## Workflow

`.github/workflows/ram-price-history.yml` runs on six cron ticks — `23 0`,
`23 2`, `23 5`, `23 12`, `23 14` and `23 17` UTC — three per slot, and can be
triggered manually via **Run workflow** (with an optional `force` input). The
run log prints the resolved slot and whether it recorded or skipped. The
workflow creates the `ram-price-data` branch on first run and commits only when
the file changed.

