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

Set `FORCE=1` to bypass the "last sample is under 10 hours old" guard.

Both the RPC read and the Alcor read must succeed — on any failure the script
exits non-zero and writes nothing, so a partial sample never enters the series.

## Workflow

`.github/workflows/ram-price-history.yml` runs on four cron ticks —
`23 0`, `23 2`, `23 12` and `23 14` UTC — and can be triggered manually via
**Run workflow**. The `:23` ticks at 00 and 12 are the primary samples; the ones
two hours later are catch-ups for when GitHub's shared cron queue drops a tick.
Because the sampler skips when the newest record is under 10 hours old, a
catch-up tick is a no-op whenever the primary tick already ran. The workflow
creates the `ram-price-data` branch on first run and commits only when the file
changed.
