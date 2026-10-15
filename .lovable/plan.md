# CHEESEFolio: faster, finished scans plus WAX/USD and realisable value

## Goal
A full scan of a heavy account like liquidcheese finishes reliably in under about a minute. Profit/loss can be shown in WAX or USD. Each holding shows what it could really be sold for, as well as its paper value.

## 1. Fix the stuck "order fills" stage
- **Work out fills locally first.** Many Alcor order-book fills can be matched to the order the account placed earlier (same market, a single open order that fits). Those need no network lookup.
- **Only look up the fills that are left over.** Each history service is first checked with one quick transaction request. Services that hang on these requests (waxsweden did in testing) are left out of this stage.
- **Shorter waits.** Each lookup gives up after about 5 seconds and moves to the next working service. Anything still unresolved is kept and retried on the next Sync, and the holding shows "some fills unpriced" instead of the scan hanging.
- **Progress stays visible.** "Matching fills 420 / 1,630", with Stop and Continue working at this stage too.

## 2. Liquidity positions from Alcor directly
- Read the account's Alcor liquidity position history (adds, removes, fees collected) from Alcor's own position data, not by rebuilding it from raw transfers.
- Use it to price LP adds/removes and fee income correctly. Transfers stay the source for everything else, and live balances stay the truth.
- If Alcor's data can't be reached, fall back to today's transfer-based method and show a small note.

## 3. Profit/loss in WAX or USD
- Add a WAX / USD toggle to the portfolio summary, holdings table, token detail and activity feed.
- USD figures use the WAX→USD price **on the day of each trade** (from the daily price history), not today's rate, so USD profit/loss is accurate rather than just converted.
- Your choice is remembered in the browser. CSV exports include both columns.

## 4. Realisable vs paper value
- **Paper value** = amount × current price.
- **Realisable value** = what selling the whole holding would actually return right now, using the existing swap quote engine (pool depth and fees included).
- Show both in holdings, plus the gap in %. Quotes load in the background and in limited batches. Tiny or unpriceable tokens show "–".

## 5. Check against real accounts before calling it done
- Scan liquidcheese, benoisballzz and cheesetradez from scratch in the preview. Record scan time, then compare each token's history total with its live balance.
- Look into the remaining CHEESE (~2,975) and LSWAX (~492) differences on liquidcheese, and fix them or explain them.
- Spot-check several order-book fills and one LP position by hand on waxblock.

## Technical details
- `scanner.ts`: add `inferFillsLocally(transfers, account)`, which matches `alcordexmain` "order match" receipts to earlier order placements (the buy/sell memo shows the market). Only unambiguous matches are kept. Add `probeTxProviders()`: one `get_transaction` call with a 4s timeout, which removes failing hosts from `enrichFills`. Lower the per-tx timeout to about 5s. `fillChecked` is set only on success, so unresolved fills retry next sync.
- New `src/lib/folio/alcorPositions.ts`: fetch Alcor position history for the account. Results are cached in the IndexedDB record and always re-derived, never replacing the raw transfers. The ledger takes LP cost and fee data from it when present.
- `prices.ts`: add `waxUsdAt(ts)` from the daily price series. The ledger stores `costUsd` and `realizedUsd` next to the WAX values, worked out per event.
- Realisable value: a `useRealisableValues(holdings)` hook that runs swap quotes (token→WAX) through the existing quote core, with limited concurrency and React Query caching for 5 minutes.
- Bump the storage schema only if needed. Saved raw transfers are kept, so no rescan from scratch is needed.
- Tests: local fill inference (unambiguous match, ambiguous match skipped), tx-provider exclusion, USD cost using the trade-day rate, and the realisable value and gap maths.
