# Make CHEESESwap quotes fast again (with Defibox and TacoSwap)

## Likely causes (confirmed by measuring first)
The Defibox/TacoSwap upgrade added three delays on top of the old quote:
1. **Waiting for Defibox/TacoSwap.** The Alcor search doesn't start until their pools arrive, which can take up to 4 seconds. The first time, TacoSwap's full list of about 8,300 pools is downloaded, which is slow.
2. **Too many extra searches.** To find the best share for Defibox/TacoSwap, the route search runs Alcor's split search about 16 more times. Then it runs the full 1% search one more time.
3. **These extra searches run even when they can't help.** Small trades, or pairs where Defibox/TacoSwap is priced worse, still pay the full cost.

## The changes
1. **Measure.** Time each step for WAX→CHEESE (100 and 5,000), CHEESE→WAX 20,000 and WAX→WAXUSDC 20,000, so every change is checked against real numbers.
2. **Don't wait for Defibox/TacoSwap.** Start the Alcor search straight away. Defibox/TacoSwap pools load at the same time, and the blend step only uses them if they are already there.
3. **Quick check before blending.** Compare Defibox/TacoSwap's price after fees with what Alcor pays for the last 1% of the trade. That costs one small extra search. If Defibox/TacoSwap can't beat it, skip the blend entirely, so most small trades are as fast as before.
4. **Fewer searches when blending.** Use a narrowing search on the Defibox/TacoSwap share instead of trying about 16 fixed shares: about 5–6 searches, each at 5% steps, then one final 1% search. It must reach the same result or better. If it doesn't, keep the current method for that pair.
5. **Load the pool lists earlier.** Start downloading the Defibox and TacoSwap pool lists when the swap window opens, not when tokens are picked. They stay saved in the browser for 6 hours. Once saved, a quote only reads the one or two live pools it needs, which is under a second. Lower the time limit from 4 s to 1.5 s once the lists are saved.

What doesn't change: Defibox/TacoSwap are only used when they strictly beat Alcor alone, the Swap button stays locked until the final route is ready, and transactions are built the same way.

## How I'll check it
- Time each test trade before and after. Goal: Alcor-only trades as fast as before the upgrade, and blended trades within about 1 s of that.
- The blended output must be the same as or better than the current version for every test trade.
- Tests and build pass. In the browser, check that the quote appears quickly and the button unlocks.

## Technical details
- `alcorRouter.computeAlcorTrade`: stop awaiting `ammPromise` before `runQuote`. Pass pools if already resolved (`Promise.race` with 0 ms). A late arrival triggers no re-quote; the next quote uses it.
- `alcorQuoteCore.blendWithAmm`: marginal gate `Q(A) − Q(0.99A)` vs best AMM `ammAmountOut(1% A)`. Ternary search over share 1–100 on coarse (5%) Alcor quotes, then a final fine quote. Memo-ise per share.
- `ammSwapPools`: `prefetchAmmIndexes()` on widget mount. The budget is 1500 ms when the index is cached and 4000 ms when cold.
- Add timing to `quoteDiagnostics` (`ammWaitMs`, `blendMs`, `blendQuotes`).
