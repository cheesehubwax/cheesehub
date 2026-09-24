# Make CHEESESwap find the best route faster

## Where the time goes today

Each quote waits for all of these, one after the other:

1. **The whole Alcor pool list** (about 2 MB to download and 11.6 MB to unpack, the same one we cut out of the price refresh). It is only kept for 20 seconds, so a new quote soon after often downloads it again.
2. **Price detail (ticks) for up to 56 pools**, fetched 10 at a time. Each pool's detail is kept for 5 minutes, but changing either token needs a new set.
3. **The route search itself** tries every 1% split across up to 6 legs. It runs in the page's main thread, so the page can feel frozen while it works.
4. The quick Alcor quote is ready early, but it is held back until the full search finishes.

## What WAX Terminal teaches us

- **Show saved data first, refresh behind.** It paints from saved data straight away and updates quietly in the background.
- **Keep downloads small.** It asks for only what it needs.
- **Limit how many requests run at once, and skip slow sources.** This keeps it fast without being blocked for sending too many requests.

## The changes

1. **Measure first.** Time each of the four steps in a real browser for WAX→CHEESE, WAX→WAXUSDC and WAX→WAXWBTC, so each change is judged against real numbers.
2. **Keep the pool list longer and save it in the browser.** The list of which pools exist hardly changes, so keep it for 10 minutes and save it in the browser. Returning visitors skip the 2 MB download. The fresh price detail in step 2 is still read for every quote, so prices stay live.
3. **Show the quick Alcor quote straight away**, labelled "Finding a better split…", and swap in the split route when it is better. The Swap button stays disabled until the search is done, so nobody signs a worse route by accident. This keeps the rule that a 100% route is never shown as the final best price.
4. **Start fetching early.** When both tokens are chosen, before an amount is typed, fetch the pool list and price detail for those tokens so they are ready when the amount arrives.
5. **Move the route search off the main thread.** It runs in the background so typing and scrolling stay smooth. A new amount cancels the old search.
6. **Search smarter, with the same result.** First search in 5% steps, then search in 1% steps only around the best split. Check that this gives the same result as the full 1% search on the test pairs. If any pair gives a worse result, keep the full search for it.

What does not change: the pools that are considered (including PARAUSD), how the transaction is built, and the rule that the SDK route must beat Alcor's own quote.

## How I'll check it

- Time each test pair before and after. Goal: first quote in under 1 s, final route in about 2–3 s the first time, and faster on later quotes.
- Final output must match the current router exactly (or the smarter search is not used for that pair).
- Full test suite and build pass. Check in the browser that the Swap button stays locked until the final route is ready.

## Technical details

- `src/lib/alcorRouter.ts`: POOLS_TTL_MS 20s → 10 min, plus `statCache` persistence (`alcor-pools-lite`, keeping only the fields the router needs: id, active, fee, liquidity, tokenA/B, sqrtPriceX64, tick); tick TTL unchanged; add `prefetchPairPools(tokenIn, tokenOut)`.
- Route search moves to `src/workers/alcorRoute.worker.ts` (Vite `?worker`), receiving pools and ticks as plain data; keep the current in-thread path as a fallback if the worker can't start.
- Coarse-to-fine percents: 5% grid, then 1% refinement ±5% around the chosen legs; exact-match check in `src/test/alcorRouter.test.ts` using recorded tick fixtures.
- `useSwapRoute`: return an early `provisional` HTTP route (with `quoteComplete: false`) while the SDK search runs; `CheeseSwapWidget` shows the pending label and disables Swap until `quoteComplete`.
- `CheeseSwapWidget`: call prefetch when both tokens are set.
