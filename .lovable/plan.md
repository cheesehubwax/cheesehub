# CHEESESwap: faster Alcor route search (5% first, then 1%)

## Goal
Cut the remaining 7–9 seconds on big trades without ever giving a worse price.

## How it works
1. **Rough search** — try splits in 5% steps (20 options per leg instead of 100). This is far quicker.
2. **Fine search** — take the routes the rough search picked and re-check them in 1% steps, only within ±5% of each chosen share.
3. **Safety net** — keep the result only if it is at least as good as the full 1% search. While testing, both run and are compared; if any test trade comes out worse, that case keeps the full search.

## Proving it gives identical results
- Record real pool data for WAX→CHEESE (100, 5,000), CHEESE→WAX 20,000, WAX→WAXUSDC 20,000, WAX→WAXWBTC small and large.
- For each, compare the new search vs the current full 1% search: output must match to the smallest unit (or be higher).
- Time both. Only switch on if every case matches; otherwise leave the full search on for the cases that don't.
- Tests and build pass; in the browser, the quote appears and the Swap button unlocks as before.

## What doesn't change
The pools considered (including PARAUSD, Defibox, TacoSwap), how the transaction is built, the rule that the final route must beat Alcor's own quote, and the Swap button staying locked until the final route is ready.

## Technical details
- `alcorQuoteCore.quoteFromData`: first `runBestTradeWithSplit` with a 5% percents grid; then a second call restricted to the routes used by the coarse result, with 1% percents; pick the better of fine vs coarse.
- The SDK's `bestTradeWithSplit` takes one percent list for all routes, so the fine pass narrows the route set (the main cost) rather than per-route windows; if narrowing loses output in fixtures, widen to top-N coarse routes.
- Recorded fixtures + exact-match test in `src/test/alcorRouter.test.ts`; `quoteDiagnostics` gains `coarseMs`, `fineMs`.
- `blendWithAmm` keeps using the final fine result unchanged.
