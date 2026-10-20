# CHEESEFolio: show values in BTC and ETH, with daily price history

## What you get
- Two dropdowns above the summary boxes:
  - **Crypto:** WAX, BTC, ETH
  - **Fiat:** USD, AUD, EUR and the other 28 currencies already offered
- Only one is in use at a time. Picking from one switches the figures to that currency, and the other dropdown dims. Your choice is remembered in this browser.
- In BTC or ETH, everything works the way fiat does now: paper value, average cost, unrealised and realised P/L, the chart and the CSVs.
- **Full history:** each past trade is valued at that day's BTC or ETH price. A 2021 buy is costed in BTC at 2021's WAX→BTC rate. So the P/L answers "did this beat just holding Bitcoin or Ether?"
- WAX mode works exactly as it does now. Under each WAX amount you still see the fiat figure.

## Where the prices come from
- Daily BTC/USD and ETH/USD closing prices from Binance (BTCUSDT, ETHUSDT), back to December 2019. That is the same source and day boundary already used for WAX/USD.
- Bitfinex is the backup if Binance can't be reached. Any day still missing is left empty, never guessed.
- The value right now uses today's live BTC/ETH price, with the latest recorded day as the fallback.

## How the data stays fresh
1. The existing FX backfill workflow also fills BTC and ETH from December 2019 to today.
2. The nightly price workflow adds the newest day, as it already does for currencies.
3. The same safety rules apply. Gaps are carried forward for at most 7 days. Existing days are never overwritten with blanks. A write is refused if the source returns far too little history.

## How it behaves when data is missing
- If a day's BTC/ETH price is missing, that token shows the existing "partly unpriced" badge.
- If the history file can't be loaded, the page goes back to WAX and shows a short note.

## Technical details
- Store the data in the same `data/fx-usd-history.json` file under `currencies.BTC` and `currencies.ETH`, as **units per 1 USD** (that is, 1 / BTCUSD). Then the existing `fxLookup` and `combineWaxFiat` work unchanged. Store at 6 significant figures; values around 1e-5 still keep 6 significant digits.
- `fxCore.ts`: add `CRYPTO_CURRENCIES = [{code:'BTC',symbol:'₿',decimals:8},{code:'ETH',symbol:'Ξ',decimals:6}]` and widen the display code to `FiatCode | CryptoCode`. Keep `ECB_CODES` free of crypto. Add a pure `parseBinanceKlines` helper and an `invertUsd` helper.
- `scripts/token-price-history/fx.ts`: fetch klines in 1,000-day pages, with Bitfinex `tBTCUSD`/`tETHUSD` 1D candles as the fallback. Run the existing `carryForward`, invert and merge, using the same never-blank merge.
- `useFolio`: accept the crypto codes. For the live "now" value, use the live Binance ticker and fall back to the last recorded day. The ledger receives `waxFiatAt` exactly as it does now.
- Formatting: `Intl.NumberFormat` doesn't support BTC/ETH, so add a `money()` branch that uses the symbol and fixed decimals (BTC 8, ETH 6). CSV headers use the code.
- `Folio.tsx`: replace the "Show in WAX" button and the fiat select with two Selects. Store the choice in localStorage under `cheesefolio-currency`; the old values still read correctly.
- Tests: inverting kline data; cost uses the purchase-day BTC rate, not today's; gaps over 7 days stay empty; USD and WAX results are unchanged.
- AGENTS.md: update the FX rule so it says crypto quotes are stored per USD in the same file, and unknown rates stay unknown.
