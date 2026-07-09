# Close the quality gap with Alcor + Multiroute visual + Min. Received sanity

## 1. Better routing quality (`src/lib/alcorRouter.ts`)

Diff vs. Alcor after inspecting the SDK source (`@alcorexchange/alcor-swap-sdk`):

- **maxSplits**: we pass `4`, Alcor SDK default is `10`. Alcor's screenshots show up to 6 splits; ours is hard-capped at 4. Raise to `10` in both `computeShadowQuote` and `computeAlcorTrade`.
- **distributionPercent**: we use `5` (grid: 5,10,…,100). Alcor's UI uses `2` (grid: 2,4,…,100), which is why their splits land on exact percentages like 30/25/25/20 rather than getting quantized to 5% steps. Change default to `2`.
- **Pool cap**: raise from `200` to `400`. WAX has ~250–350 active pools; `200` may still truncate hot pairs like WAX↔LSWAX. `400` effectively removes the cap while keeping a safety ceiling on ticks fan-out.
- **Prefer the WASM router when available**: `Trade.bestTradeWithSplitWASM` exists in the SDK and is what Alcor's own UI runs. Signature: `(routes, amount, percents, tradeType, pools, swapConfig)`. Try it first; fall back to the JS `bestTradeWithSplit` if the WASM module isn't loadable in this build. Pure quality+performance win — lets the finer distribution grid + higher maxSplits actually run to completion.

No changes to `selectRelevantPools` beyond the cap bump.

## 2. Multiroute visual: show start + end tokens (`src/components/swap/MultiRoutePanel.tsx`)

Today each row is: `{percent} {pair-icon fee} … {pair-icon fee}`. Alcor's row is: `{percent} {startToken} {hop fee} … {hop fee} {endToken}`.

Change each row to:

```text
{percent%}  [tokenIn]  ─  [pairA↔B fee]  ─  [pairB↔C fee]  ─  [tokenOut]
```

- Prepend a solo `TokenLogo` for `tokenIn` after the percent.
- Append a solo `TokenLogo` for `tokenOut` at the end.
- Keep the existing overlapping pair icons + fee for each hop, joined by the existing dashed connector.
- Endpoint chips use `size="md"` with a subtle `ring-1 ring-border/50` so they read as endpoints, not hops.
- For a single-hop route, still render solo endpoints on either side — matches Alcor's layout.
- No changes to data flow (`useAlcorPools`, chain building) or to loading/error states.

## 3. "Min. Received" sanity (verify, not change)

User reports: "You receive 83.66055322, Min. Received 82.83223091 — min should be less than the output shown."

Numerically, `82.83223091 < 83.66055322`, so the currently displayed values are already in the correct relationship (min < output). What the user is likely reacting to is the *gap*: at 1% slippage the min should be ~`output × 0.99 = 82.824…`, and we're showing `82.832`, which is very close but not identical.

- Trace this: in `computeAlcorTrade` we set `aggMin = trade.minimumAmountOut(slip)` for EXACT_INPUT, then `route.output = trade.outputAmount.toFixed()` and `route.minReceived = aggMin.toFixed()`. Both go through the SDK's fixed-point math so tiny sub-basis-point deltas vs. a naive `output * 0.99` are expected and harmless.
- Add a defensive guard in `computeAlcorTrade`: if `parseFloat(aggMin.toFixed()) > parseFloat(trade.outputAmount.toFixed())` (which should never happen at positive slippage), log a warning and clamp `minReceived` to `output`. Cheap invariant check; catches any future SDK-version regressions.
- No UI change beyond that — the widget already renders both fields correctly. If after the fix the user still perceives an inversion, we'll ask for the exact numbers to debug the specific pair.

## Verification

- Load `/testfarm2` → open swap dialog → WAX → LSWAX @ 100. Output should now be within a few basis points of Alcor's UI, with 3–6 splits.
- Multiroute row 1 starts with the WAX icon and ends with the LSWAX icon; middle hops render as overlapping pair icons.
- Confirm `Min. Received` (LSWAX) is always ≤ `You receive` (LSWAX). At 1% slippage the ratio should be ≈ 0.99.
- Sanity: single-hop pair (WAX ↔ CHEESE) still renders one hop with WAX on left, CHEESE on right.
- `bunx vitest run src/test/shadow.test.ts` still passes (or improves parity vs. the HTTP endpoint).

## Out of scope
- No changes to memo format, `normalizeRouteActions`, transaction execution, swap button, or HTTP fallback.
