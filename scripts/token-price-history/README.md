# CHEESEFolio token price history

Records the WAX price of every priced Alcor token once per UTC day, plus the
WAX/USD rate. CHEESEFolio uses it to value token-for-token trades and to draw
the portfolio value chart. Public market data only — no user data.

- Runner: `.github/workflows/token-price-history.yml`
- Output branch: `token-price-data`
  - `data/index.json` — list of recorded dates
  - `data/days/YYYY-MM-DD.json` — `{ date, waxUsd, prices: { "contract:SYMBOL": waxPerToken } }`
  - `data/tokens.json` — versioned public metadata: contract, symbol, chain-verified precision, name (symbol when no official name is supplied), and Alcor logo URL. No prices or user data.

The existing **Token Price History** workflow also refreshes the registry, even
when today's prices already exist. Run it manually once to create the first
snapshot. New/changed identities are checked against `get_currency_stats` using
six workers and health-ordered RPC fallback; unchanged verified identities are
reused. Invalid/scam entries are excluded and an abnormally small snapshot is
rejected. A logo URL is a reference, not a guarantee the image exists offline.
The app caches metadata for offline fallback; live prices remain separate and
unknown prices are not replaced by yesterday's values.

Local run:

```sh
TOKEN_PRICE_DIR=/tmp/token-prices bun run sample.ts
```

## WAX/USD backfill

`data/wax-usd-history.json` — one flat `{ "YYYY-MM-DD": usdPerWax }` map from
Dec 2019 to today (Bitfinex tWAXUSD before Aug 2021, Binance WAXPUSDT after,
gaps carried forward up to 7 days). Built once by
`.github/workflows/token-price-backfill.yml` (`backfill.ts`, run manually);
the daily recorder appends each new day. Backfilled day files get `waxUsd`
with `prices: {}`; days that already have token prices are left untouched.

## CHEESE price history

`data/cheese-usd-history.json` — `{ "YYYY-MM-DD": { "wax": waxPerCheese, "usd": usdPerCheese } }`
from 28 Jan 2024 (first traded day of Alcor CHEESE/WAX pool 1252) to today.
Built once by `.github/workflows/cheese-price-backfill.yml` (`cheese-backfill.ts`,
run manually after the WAX/USD backfill); the daily recorder appends each new day.
Day files missing a CHEESE price get `prices["cheeseburger:CHEESE"]`; recorded
prices are never overwritten.

## Fiat exchange rates (`data/fx-usd-history.json`)

`{ updatedAt, currencies: { AUD: { "YYYY-MM-DD": perUsd } } }` for 30 currencies
(ECB reference rates via Frankfurter; RUB from the Central Bank of Russia since
the ECB dropped it in March 2022). Weekends/holidays carry the last rate up to
7 days. Built once by `.github/workflows/fx-backfill.yml` (`fx.ts`, `FULL=1`);
the daily recorder refreshes the last 21 days and never blanks existing days.
CHEESEFolio converts WAX → USD → chosen currency using each day's rates.
