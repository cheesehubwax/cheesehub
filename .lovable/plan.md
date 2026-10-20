# CHEESEFolio: values in many currencies, with full daily FX history

## What you get
- A currency dropdown on CHEESEFolio (next to the existing WAX/USD figures). The choice is remembered in this browser.
- Every money figure shown in USD today (paper value, average cost, unrealised and realised P/L, charts, CSV) can show in the chosen currency instead.
- Past purchases use **that day's** exchange rate, so a May 2021 buy in AUD is costed at May 2021's AUD rate. Values today use today's rate.

## Currencies (about 31)
USD, AUD, CAD, EUR, GBP, JPY (Yen), CNY (Yuan), INR (India), RUB (Russia), NZD, CHF, SEK, NOK, DKK, PLN, CZK, HUF, RON, TRY, KRW, SGD, HKD, TWD-free set below, IDR, MYR, PHP, THB, ZAR, BRL, MXN, ILS, ISK.

Notes:
- Most come from the European Central Bank daily reference rates (free, no sign-up, back to 1999).
- **Russia (RUB):** the European Central Bank stopped publishing it in March 2022, so RUB comes from the Central Bank of Russia's official daily rates instead.
- Taiwan dollar and a few others (UAE dirham, Saudi riyal, Vietnamese dong, Nigerian naira) have no equally reliable free daily history, so they are left out rather than shown with doubtful numbers. They can be added later if you want a second source.

## How the data stays fresh
1. **One-time backfill workflow** fills every day from December 2019 (start of WAX price history) to today, for every currency.
2. **Nightly step** added to the existing daily price workflow adds the newest day.
3. Weekends and bank holidays (no published rate) carry the last rate forward for up to 7 days, same rule as WAX/USD. Longer gaps stay empty.
4. Safety: the workflow refuses to write if a source returns far too little history, and never overwrites existing days with blanks.

## How it shows in the app
- Rates load once from the same shared public data branch as WAX/USD (no personal data involved; scans stay in your browser).
- If a rate is missing for some day, that token is marked like today's "partly unpriced" USD case rather than guessing.
- If the rates file can't be reached, the dropdown falls back to USD and says so.

## Technical details
- New `scripts/token-price-history/fx-backfill.ts` + `.github/workflows/fx-backfill.yml` (manual dispatch); nightly append in `sample.ts`/`token-price-history.yml`.
- Sources: Frankfurter API (ECB) `/{from}..{to}?base=USD` in yearly chunks; CBR `XML_daily.asp?date_req=DD/MM/YYYY` (or `XML_dynamic` for USD) for RUB, converted to RUB per USD.
- Output on `token-price-data`: `data/fx-usd-history.json` = `{ "updatedAt", "currencies": { "AUD": { "YYYY-MM-DD": perUsd } } }`, rates at 6 significant figures. Day files untouched.
- App: `src/lib/folio/fx.ts` (fetch + per-currency lookup with nearest-earlier-within-7-days), currency list constant with symbol/decimals (JPY/KRW/IDR 0 decimals).
- Ledger change kept minimal: instead of passing `waxUsdAt`, pass `waxFiatAt(ts) = waxUsd(ts) × fx(ts)`; for USD fx = 1, so existing USD results are byte-identical. Value-now uses `waxUsdNow × fxToday`.
- Labels/formatters switch from hard-coded "$"/"USD" to `Intl.NumberFormat` with the chosen currency.
- Tests: fx carry-forward ≤7 days, RUB from CBR inversion, cost uses purchase-day rate not today's, USD selection unchanged vs current output, missing rate marks gap.
- Record in AGENTS.md: fiat conversions are derived as WAX→USD→fiat per day; unknown rates stay unknown.
