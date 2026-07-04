## Why the Multiroute panel still shows 100%

Phase 1 only wired the SDK router as a **shadow observer** — it logs `[shadow-router]` in the console but the actual quote powering the UI still comes from Alcor's public HTTP `getRoute` endpoint, which returns a single 100% linear route. That's why your screenshot shows `100% [pool] 0.3%` while Alcor's own UI shows 50/25/25.

To make the panel split like Alcor's, we need Phase 2: use the SDK-computed split trade as the source of truth for both **display** and **execution**.

## Phase 2 plan

### 1. Promote the shadow router to primary quote source
- `src/hooks/useSwapRoute.ts`: replace the effect-based shadow log with a real query that awaits `computeShadowQuote` first, then falls back to `fetchSwapRoute` only if the SDK returns nothing or throws.
- Adapt the SDK result into the existing `SwapRoute` shape so `MultiRoutePanel` renders unchanged:
  - `swaps[]`: one entry per SDK split, each with `percent`, `route` (pool-id array), `input`, `output`, `minReceived` (apply user slippage per split).
  - `route[]`: concat of every split's pool ids (used elsewhere for pool lookups).
  - `output`, `minReceived`, `priceImpact`: aggregated across splits.
  - `memo`: **not** used in Phase 2 — we build one memo per split at execution time (see step 3).

### 2. Per-split memo builder
- New helper in `src/lib/alcorRouter.ts`: `buildSplitMemo(split, tokenOut, slippage, receiver, tradeType)` producing the exact `swapexactin#poolId,poolId,...#minOut TICKER@contract#receiver` (and `swapexactout#…` for exact-output) string Alcor's own UI emits.
- Verified against Alcor's `alcor-ui` swap store — this is the format `swap.alcor` accepts today.

### 3. Multi-transfer execution
- `src/lib/swapApi.ts` → `normalizeRouteActions`: when `route.swaps.length > 1`, emit **one `transfer` action per split**, each with:
  - `quantity` = split's fractional input formatted to `tokenIn.precision`
  - `memo` = the per-split memo from step 2
  - All actions bundled into the same wharfkit transaction (atomic; if any split fails the whole tx reverts).
- Rounding: last split absorbs the remainder so the sum equals the user's typed amount to the last decimal.
- Single-split (100%) path stays exactly as it is today — same one-action transfer, same memo.

### 4. Safety rails
- If SDK returns a split whose aggregated `minReceived` is worse than the HTTP route's `minReceived`, fall back to the HTTP route and log a warning. Guarantees Phase 2 never gives a user a worse quote than Phase 0.
- Keep the 20s stale-quote debounce; add a hard "quote age > 30s" guard before submit to avoid stale-tick execution failures.
- Leave the shadow smoke test in place, add an assertion that at least one WAX→CHEESE quote produces `splits.length > 1`.

### 5. UI
- No component changes required. `MultiRoutePanel` already iterates `route.swaps` and renders per-split percent + hop pairs — it just hasn't been receiving multi-split data.
- `Price Impact`, `Min. Received`, and `Expected Output` in the widget already read the aggregated fields, so they update automatically.

## Files touched

- `src/lib/alcorRouter.ts` — add `buildSplitMemo`, add `toSwapRoute(shadowQuote, slippage)` adapter.
- `src/hooks/useSwapRoute.ts` — SDK-first, HTTP-fallback query; remove the shadow-only effect.
- `src/lib/swapApi.ts` — extend `normalizeRouteActions` to emit N transfers when `swaps.length > 1`.
- `src/test/shadow.test.ts` — add split-count assertion.

## Risks / open questions

- **Memo format parity**: Alcor recently added an optional deadline field. I'll cross-check the exact template against a live Alcor tx before we ship — if it differs from what's in `alcorRouter.ts`, we adjust before enabling.
- **Tick staleness**: SDK math uses ticks that can move between quote and submit. Mitigated by the 30s guard + slippage; a worst-case stale quote just reverts on-chain (no fund loss).
- **Bundle cost**: SDK is already installed and shipping in Phase 1 — no new weight.

Once you approve, I'll implement and verify by running a real WAX→CHEESE quote in the widget and confirming the Multiroute panel shows the same split percentages as Alcor's UI.