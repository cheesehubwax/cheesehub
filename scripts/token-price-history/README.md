# CHEESEFolio token price history

Records the WAX price of every priced Alcor token once per UTC day, plus the
WAX/USD rate. CHEESEFolio uses it to value token-for-token trades and to draw
the portfolio value chart. Public market data only — no user data.

- Runner: `.github/workflows/token-price-history.yml`
- Output branch: `token-price-data`
  - `data/index.json` — list of recorded dates
  - `data/days/YYYY-MM-DD.json` — `{ date, waxUsd, prices: { "contract:SYMBOL": waxPerToken } }`

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
