## Plan

Fix the missing WAX → WAXWBTC split by making the SDK router evaluate the same fine-grained allocation grid Alcor uses.

### Changes

1. Update `src/hooks/useSwapRoute.ts`
   - Remove the USD-based tiered split grid (`10%`, `5%`, `2%`).
   - Always pass `distributionPercent: 1` into `computeAlcorTrade`.
   - Remove the now-unused `priceToken`, `usdPrice`, `parsedAmount`, and `inputUsd` locals.

2. Keep the prior WAXBTC tick retry diagnostics in place
   - The retry/logging change is still useful for transient pool/tick fetch failures.
   - This change addresses the remaining issue: the router is still searching too coarsely for small trades like 500–1000 WAX.

3. Verify behavior
   - Confirm WAX → WAXWBTC now returns an SDK quote with two split legs when it beats HTTP.
   - Confirm existing split routes such as WAX → CHEESE / USDC / LSWAX still work.
   - Watch console diagnostics for `[alcor-router] SDK quote produced ... [grid=1%]` and whether SDK or HTTP wins.

### Technical notes

The current `useSwapRoute` logic still uses `10%` steps for trades under about `$30`. Alcor’s visible route is a 50/50 split, but the SDK’s optimizer can still miss or collapse split candidates when all candidate allocations are constrained to coarse buckets and the HTTP fallback wins on a strict output comparison. Using a fixed `1%` grid aligns CheeseHub with Alcor’s routing behavior and is the narrowest remaining fix.