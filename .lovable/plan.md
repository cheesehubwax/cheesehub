## Problem

1000 WAX → CHEESE:

- Alcor UI: **529.1120 CHEESE** (3 legs, 50/25/25).
- Our widget: **528.4098 CHEESE** (4 legs, 48/31/17/4).

More splits AND worse output. The split optimizer never *chooses* extra splits unless they help the total, so this means our SDK call is running on a strictly worse input than Alcor's own SDK call, and we still show the result. Two things to fix: give the optimizer the same pools Alcor has, and never let a worse split display as "best."

Not going to cap splits or force a coarse grid — the user is right: if a 2% leg genuinely improves output, keep it. The rule is *best output wins*, period.

## Root causes

1. **Pool selection drops pools Alcor keeps.** `selectRelevantPools` caps at 56 and ranks by path length → class → liquidity. For WAX → CHEESE this can drop a specific fee-tier variant (e.g. a WAX/USDC 0.05% or WAX/USDC 0.3% pool) that Alcor's UI feeds into its optimizer. Missing pools force the greedy split search into worse combinations that show up as extra, smaller legs.
2. **Greedy-split local optima.** `bestTradeWithSplit` is a greedy heuristic. At a very fine 1% grid it can occasionally land in a worse local optimum than a coarser sweep would. Cheap to defend against: run the optimizer at both grids and keep the better trade.
3. **No sanity guard.** `pickSdk` only checks `sdk.output > http.output`. There's no check that the multi-split even beats routing 100% through its own best leg. When it doesn't, we're literally displaying a worse quote for the user.

## Fix (frontend/quote-selection only)

### 1. `src/lib/alcorRouter.ts` — give the optimizer the full pool set
- Always include every active pool that touches `tokenIn` or `tokenOut` directly, bypassing the cap. These are the pools any final leg must use, so dropping them is never safe.
- Raise the overall pool cap from 56 to 96 for the remaining (intermediate) pools, still ranked by path length → class → liquidity so tick fan-out stays bounded.
- Keep existing BFS reachability filter and 429/cooldown protections unchanged.

### 2. `src/lib/alcorRouter.ts` — take the better of two split searches
- Run `bestTradeWithSplit` twice with the same routes/pools: once at the current fine grid (`distributionPercent: 1`, `maxSplits: 10`) and once at a coarser sweep (`distributionPercent: 5`, `maxSplits: 6`).
- Return whichever trade has the higher `outputAmount` (or lower `inputAmount` for EXACT_OUTPUT). Cheap; keeps the fine grid when it wins, escapes the local optimum when it doesn't.

### 3. `src/hooks/useSwapRoute.ts` — sanity guard on the winning quote
In `pickSdk`:
- Compute `bestSingleLegOutput = max over sdk.swaps of (s.output / (s.percent/100))` — i.e. what routing 100% through each leg's route alone would produce, extrapolated linearly. If `sdk.output < bestSingleLegOutput`, the split is worse than just picking one of its own legs. Fall back to HTTP and log it.
- Symmetric check for `EXACT_OUTPUT` on inputs.
- Keep the existing `sdk.output > http.output` requirement.
- Log the picked path with grid, split count, and total for every quote so the "why this quote won" is inspectable in the console.

### 4. Diagnostics
Extend `[alcor-router]` logs with: pool cap actually used, endpoint-touching pool count, both grids' outputs, and any sanity-guard rejections.

## Files touched

- `src/lib/alcorRouter.ts`
- `src/hooks/useSwapRoute.ts`

No changes to `MultiRoutePanel`, memos, execution, slippage, or transaction plugins.

## Validation

Re-quote 1000 WAX → CHEESE with the console open:
- Our aggregate output should match or beat Alcor's 529.11.
- Whichever grid wins is logged.
- If the sanity guard ever rejects an SDK quote, the log shows the split shape and totals so we can trace it.
