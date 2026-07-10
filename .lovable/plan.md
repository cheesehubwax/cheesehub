
## What's actually happening

Two independent problems combine to make the whole widget/site fall over on the very first quote:

1. **The Alcor SDK's own `Trade.bestTradeWithSplit` still loads the WASM helper (`tradeCalculatorWASM-*.js`) internally.** Removing our direct WASM call didn't help — the SDK itself calls it, and in the Vite browser bundle it throws `ReferenceError: require is not defined`. That exception bubbles up as a rejected promise inside `Promise.allSettled` in `useSwapRoute`.

2. **`useSwapRoute` classifies SDK exceptions as "transient" and re-throws them**, which triggers React Query retries. Each retry re-enters `computeAlcorTrade`, which re-runs `selectRelevantPools` and fires another burst of `/swap/pools/:id/ticks`. Alcor immediately returns 429, we retry again, and the whole quote path spirals until it either freezes the UI thread or React Query bails out.

The HTTP `/swapRouter/getRoute` fallback works fine and should be answering these quotes on its own. It isn't, because we keep insisting the SDK must succeed first.

## Fix plan (frontend only, no swap-execution math changes)

1. **Contain SDK failures inside `computeAlcorTrade`.**
   - Wrap the `runBestTradeWithSplit` call in try/catch. On any error (WASM `require`, rate-limit, SDK internal) log once and `return null` instead of throwing.
   - Do the same around `computeAllRoutes` so a bad pool set can't crash the quote either.

2. **Kill the tick-fanout as soon as Alcor rate-limits.**
   - Track `rateLimitedTickFailures` inside the concurrency loop; once it hits 2, short-circuit remaining workers to return `{ticks: []}` immediately (no more `fetch`).
   - Lower the first-quote pool cap in `selectRelevantPools` from 56 → 24 so a cold cache can't launch dozens of tick requests in one go.
   - Keep the existing 60s negative cache and the global `alcorCooldownUntil` gate.

3. **Make `useSwapRoute` treat SDK failure as non-transient, not a retry trigger.**
   - Because `computeAlcorTrade` will now `return null` instead of throwing on WASM/rate-limit, `sdkSettled.status` will be `"fulfilled"` with `null` and the HTTP route will be accepted immediately — no retry storm.
   - Leave HTTP-side transient handling intact so real network blips still self-heal.

4. **Don't warm the pool cache while cooling down or on very first paint.**
   - Move the `setTimeout(fetchAllAlcorPools)` warm-up behind a short delay (e.g. 1500 ms) so it doesn't compete with the user's first quote request for Alcor's rate-limit budget.

5. **Keep the multi-route visual metadata and all execution/memo/slippage code untouched.**

## Validation

- Reload with a cold cache, request a first quote.
- Expect: no `require is not defined` crash bubbling to React, no burst of 429s, quote appears from HTTP fallback within one retry window even if the SDK path returns null.
- Confirm the "Finding best route…" state resolves to a real quote instead of the widget locking up.
