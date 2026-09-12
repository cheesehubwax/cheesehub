# CHEESEAnal: per-pair CHEESE price, and the stale snapshot

Two separate things.

## 1. Prices should be per pair, not one USD price everywhere

Right now every pool's "CHEESE price" column shows a USD price, and when a pool has no
usable ratio of its own it silently falls back to the single global CHEESE/USD price — so
different pools show identical numbers, which reads as wrong. The price in the paired
token is already recorded per pool (from the deepest pool of that pair on that venue) but
is barely shown.

Changes:

- Pool table: the price column becomes **CHEESE price (in pair)** and shows the price in
  that pool's own paired token, e.g. `0.00000012 WAXWBTC` for CHEESE/WAXWBTC and
  `1.4372 WAX` for CHEESE/WAX. The USD equivalent is shown underneath in small text only
  when it can honestly be worked out for that pair.
- Remove the "borrow the global CHEESE/USD price" fallback: a pool with no ratio of its
  own shows `—` rather than a number copied from another pool.
- Pool detail: the price box shows the paired-token price first, USD second. The fifth
  chart becomes **CHEESE price in {SYMBOL}** plotted in the paired token, with the paired
  token's own precision.
- Add a small-number price formatter so tiny values (WAXWBTC, WAXWETH) print as readable
  decimals with enough significant digits instead of exponent notation.
- Pool history CSV keeps both columns, with clearer headers (`cheese_price_in_paired`,
  `paired_symbol`, `cheese_price_usd`).

No change to what the daily job records — the per-pair price is already stored.

## 2. The recorded day still shows $15,387

That figure is the stored 12 Sep snapshot, taken by the old code before the $100 filter
was rolled back. It cannot be corrected from the app; it has to be re-recorded on GitHub:

- GitHub → Actions → **CHEESEAnal LP History** → Run workflow, set `force` to `1`.
  This overwrites today's stored point with all 18 pools (about $17.6k) and leaves earlier
  days alone.
- Use `reset` = `1` instead only if you want to wipe all stored days and start the history
  again from today.

## Technical notes

- `src/lib/lpPools.ts` — drop the global `cheeseUsd` fallback inside `derivePriceUsd` so
  `priceUsd` is only set when the pair's own ratio can be converted.
- `src/components/anal/format.ts` — add `tokenPrice(value, symbol)` using significant
  digits, no exponent form.
- `src/components/anal/AnalPoolTable.tsx`, `AnalPoolDetail.tsx` — render
  `priceInPaired` as the headline price, `priceUsd` as secondary; price chart keys on
  `priceInPaired`.
- `src/lib/lpCsv.ts` — header rename plus paired symbol column.
- `src/components/anal/AnalOverview.tsx` keeps using the USD CHEESE price for the
  headline stat — that one is genuinely a market price, not a per-pool figure.
- Verify with a typecheck, the existing LP tests, and a browser pass on `/anal`.
