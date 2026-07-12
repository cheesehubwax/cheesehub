## Plan: make the WAXWBTC split route reachable

The 1% grid change was correct, but the live route is still missing the split because the SDK pool selector caps relevant pools at 56. For WAX -> WAXWBTC, pool `4950` (`WAXUSDC -> WAXWBTC`, 0.05%) ranks around #99, so it is never fetched/built. Alcor’s UI can split because it has that endpoint pool available.

### Changes

1. **Update `src/lib/alcorRouter.ts` pool selection**
   - Keep direct pools first.
   - Add deterministic route-completion coverage for each liquid endpoint pool: when a candidate touches `tokenOut`, also include the best connector pool from `tokenIn` to that intermediate token; and vice versa.
   - This ensures pairs like `WAX -> WAXUSDC` plus `WAXUSDC -> WAXWBTC` are included even when the endpoint pool ranks below the current cap.
   - Preserve the existing cap/ranking behavior for the broader graph so we do not explode tick requests.

2. **Add focused diagnostics**
   - Log whether key two-hop endpoint routes were included in the SDK graph.
   - Keep existing `poolsDroppedNoTicks`, `tickFailures`, and route counts.

3. **Keep existing quote selection logic**
   - Leave `distributionPercent: 1` in place.
   - Continue requiring the SDK quote to beat the HTTP fallback before using it.

4. **Verify**
   - Check that WAX -> WAXWBTC with 1000 WAX includes pool `4950` and can produce the Alcor-style split.
   - Confirm existing routes still quote normally and tick fanout remains bounded.