# CHEESESwap: find and fix the 20+ second quotes

## What is known so far
- Alcor's own services answer quickly right now (quick quote about 0.3 s, pool list about 0.5 s, pool price detail about 0.1 s). So Alcor being slow is probably not the cause, at least not at the moment.
- Your preview didn't record any swap activity, so the cause of the 20 seconds is **not confirmed yet**. I won't guess at it. The first step is to measure it.

## Likely suspects to check
1. **Slow or unreachable chain nodes.** Price detail for pools that Alcor rate-limits falls back to chain nodes. A dead node can make each read wait for its full time limit, like the homepage problem we had earlier.
2. **Retries.** If the full search hits a temporary error, it retries up to 3 times with growing waits (up to 30 s after a rate limit). That alone can reach 20 s or more.
3. **Waiting on Defibox/TacoSwap** longer than the intended 1.5–4 s.
4. **The background search failing** and quietly moving back onto the main page, which runs slower and can freeze the page.
5. **The route search itself** on big trades. It took 7–9 s before and may have grown as pools were added.

## Steps
1. **Measure in a real browser.** Time every stage for WAX→CHEESE (100 and 5,000), CHEESE→WAX 20,000 and WAX→WAXUSDC 20,000, both the first time and on repeat. Stages: pool list, price detail per pool (and which source served it), Defibox/Taco wait, route search, retries.
2. **Fix only what the numbers show**, for example:
   - Put a hard time limit on each price-detail read and try healthy nodes first, using the existing node-health ordering. Skip a pool that won't load instead of stalling the whole quote.
   - Retry only the part that failed, not the whole quote, and don't wait 5–30 s before the first retry.
   - Make sure the Defibox/Taco time limit is actually respected.
   - Fix the background search if it is failing to start.
3. **Keep these rules the same:** the full 1% search (no shortcuts that could give a worse price), every pool is considered, the final route must beat Alcor's quote, and the Swap button stays locked until the final route is ready.

## How I'll check it
- Take before and after timings for each test trade. Goal: the quick quote in about 1 s and the final route well under 10 s.
- The final output must be the same as before for each test trade.
- Tests and build pass.

## Technical details
- Add per-stage timings to `quoteDiagnostics` (`poolsMs`, `ticksMs`, per-source tick counts, `ammWaitMs`, `searchMs`, `workerUsed`, `attempt`) and log them in `useSwapRoute`.
- Review `fetchTicks` fallback path in `alcorRouter.ts`, the `retry`/`retryDelay` settings in `useSwapRoute`, the AMM budget in `ammSwapPools.ts`, and `failAllToMainThread` in `alcorQuoteRunner.ts`.
