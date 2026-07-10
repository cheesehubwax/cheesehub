## Goal
Make CHEESESwap show the best multiroute split on the first quote attempt for cases like `10 WAXUSDC -> ROOK`, instead of first showing Alcor HTTP's 100% single-route quote and only switching to the better split after several refreshes.

## What is wrong now
The current code can still expose the worse single-route quote because the HTTP route is treated as valid immediately whenever the SDK split route is unavailable, delayed, or skipped during Alcor cooldown. This creates a timing problem: users see a complete-looking 100% route even though the SDK route may become much better a few checks later.

## Plan

1. **Make SDK split routing first-class for quote finality**
   - Keep running HTTP and SDK quote paths in parallel.
   - For routes where SDK routing is expected/possible, do not finalize the HTTP 100% route until the SDK split router has actually completed, failed definitively, or timed out.
   - Use a bounded wait window for the SDK leg so the UI does not hang forever.

2. **Stop skipping SDK purely because global Alcor cooldown is active for active user quotes**
   - The cooldown currently protects against fanout, but it can also prevent the split router from running exactly when the user needs the best quote.
   - Adjust cooldown behavior so active swap quotes can still use cached pool/tick data and only avoid fresh fanout when necessary.
   - If SDK cannot run because required data is not cached, keep the HTTP route marked as provisional instead of silently presenting it as the final best route.

3. **Add a quote-quality state internally**
   - Distinguish:
     - final SDK split route
     - final HTTP-only route after SDK was checked
     - provisional HTTP route while SDK is still warming/checking
   - The widget should only show the route as normal/final once best-route checking is complete.

4. **Prefer the SDK split whenever it materially improves output**
   - For `EXACT_INPUT`, choose SDK when it has 2+ splits and better output than HTTP.
   - For `EXACT_OUTPUT`, choose SDK when it has 2+ splits and lower required input.
   - Reduce or remove the current 0.05% threshold if needed, because your screenshot shows even small route differences can be user-visible and Alcor itself chooses the split.

5. **Improve diagnostics**
   - Log why a quote chose HTTP or SDK:
     - SDK pending timeout
     - SDK skipped due missing cached data
     - SDK failed due 429/ticks/pools
     - SDK won with split count and output delta
     - HTTP won only after SDK was actually checked
   - This makes it clear whether future 100% routes are genuinely optimal or just fallback behavior.

6. **Keep execution safety**
   - Preserve per-split memos and multi-transfer execution.
   - Do not change token selection, slippage UI, signing, or transaction plugins.
   - Keep Alcor rate-limit protections, but avoid letting rate-limit fallback masquerade as best execution.

## Files to update
- `src/hooks/useSwapRoute.ts` — route selection, provisional/final quote behavior, SDK wait policy, logging.
- `src/lib/alcorRouter.ts` — cached-data/cooldown handling for active SDK quotes if needed.
- `src/components/swap/CheeseSwapWidget.tsx` — only if needed to show loading/provisional state instead of a final-looking worse quote.

## Validation
- Test the user-provided case: `10 WAXUSDC -> ROOK`.
- Confirm first settled quote shows the split route comparable to Alcor’s UI, not the 100% route.
- Confirm single-pool routes still work when SDK checks and finds no better split.
- Confirm swap execution still uses one transfer per split when multiroute wins.