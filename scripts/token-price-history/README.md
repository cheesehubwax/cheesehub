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
