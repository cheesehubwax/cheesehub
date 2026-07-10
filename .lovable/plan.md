Plan to fix the current Alcor quote errors without changing swap execution math:

1. Disable the broken WASM router path in the browser
   - The console shows `Failed to load WASM module: ReferenceError: require is not defined`.
   - Keep using the SDK’s JS split router instead of attempting `bestTradeWithSplitWASM` in Vite/browser builds.
   - This removes the noisy WASM failure and avoids wasting time before the JS fallback.

2. Stop tick-request fanout after the first 429
   - The current router still launches many `/swap/pools/:id/ticks` requests concurrently, so one rate limit becomes a page of 429s.
   - Lower tick concurrency and make the queue check the global Alcor cooldown before starting each next tick fetch.
   - When a 429 happens, mark cooldown and skip remaining non-essential tick requests for that quote instead of continuing to hammer Alcor.

3. Reuse cached tick/pool data aggressively
   - Keep successful tick responses cached.
   - Keep failed tick negative-cache behavior, but extend it enough that repeated quote retries do not immediately re-request the same failed pools.
   - Preserve the existing single HTTP route fallback so users still get a quote when SDK split routing is rate-limited.

4. Keep the multiroute visual metadata fix intact
   - Do not touch amounts, slippage, memos, transfer construction, or route comparison rules.
   - The only behavior change is preventing excessive Alcor tick requests and avoiding the browser-incompatible WASM attempt.

Validation:
- Run TypeScript/build check.
- Hard refresh and request a first quote.
- Confirm console no longer shows WASM `require is not defined`.
- Confirm tick 429s no longer appear as a burst; if Alcor rate-limits, the app backs off and uses the HTTP route/retry path cleanly.