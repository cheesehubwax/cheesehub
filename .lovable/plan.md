# Why 100 USDC → CHEESE crashes

The Alcor swap SDK ships two routers:

- `bestTradeWithSplitWASM` — fast, but the shipped `wasm_route_finder.js` is a **Node-only** build (uses `require('util')` and `module.exports`). In a browser it throws `require is not defined`, which is exactly the "Failed to load WASM module" error in the console.
- `bestTradeWithSplit` (pure JS) — always used in our app because WASM never loads. Its cost grows fast with the percent-grid × number of candidate routes × `maxSplits`.

Our grid in `useSwapRoute.ts` is:

- `inputUsd < $30` → 5% steps (20 percents)
- `inputUsd ≥ $30` → 1% steps (100 percents)

At **10 USDC** we use 20 percents → fine. At **100 USDC** we jump to 100 percents, and USDC has many multi-hop routes to CHEESE → the JS splitter combinatorially explodes and locks up / crashes the tab. 10k WAX works because WAX↔CHEESE has far fewer viable routes to combine.

So the recent quote/visual changes were not the cause; the JS splitter is the bottleneck whenever we hand it a fine grid on a high-connectivity token like USDC.

## Fix (visual + logic, minimal)

Two small, targeted changes. No swap-math changes.

### 1. `src/lib/alcorRouter.ts` — skip WASM in the browser

- Detect browser once (`typeof window !== "undefined"`) and short-circuit `runBestTradeWithSplit` to the JS path directly.
- Removes the noisy `console.error("Failed to load WASM module")` and the wasted async import on every quote.
- Do the same guard for any `fromRouteWASM` / `createTradeFromRouteWASM` call sites if present.

### 2. `src/hooks/useSwapRoute.ts` — coarser, bounded grid

Replace the two-bucket grid with a monotonic ramp that never gets fine enough to hang the JS splitter:

```text
inputUsd < $30      → 10% steps  (10 percents)
$30 ≤ inputUsd < $300 → 5% steps  (20 percents)
inputUsd ≥ $300     → 2% steps  (50 percents)
usdPrice unknown    → 5% steps  (safe default)
```

Rationale: Alcor's own UI runs the WASM splitter, which can afford 1% steps. Our JS fallback cannot. 2% is still finer than what most user-visible splits benefit from, and it keeps the worst case bounded.

### 3. `src/lib/alcorRouter.ts` — cap `maxSplits` for JS

When the JS path is taken, pass `swapConfig = { minSplits: 1, maxSplits: 4 }` (down from 10). Split counts above ~3–4 rarely improve quote quality but multiply cost.

## Validation

- Hard refresh, quote 10 USDC → CHEESE: still works, same output as before.
- Quote 100 USDC → CHEESE: returns a route without freezing; multiroute panel renders (embedded `visualPath`/`visualFees` already handles the first-quote visual from the previous fix).
- Quote 10k WAX → CHEESE: unchanged.
- Console no longer shows "Failed to load WASM module".
- Compare final output against Alcor's UI for 100 USDC to confirm no regression from the coarser grid; if Alcor is meaningfully better on a specific size, we can tune the thresholds.

## Files touched

- `src/lib/alcorRouter.ts` — skip WASM branch in browser, lower `maxSplits` for JS path.
- `src/hooks/useSwapRoute.ts` — new 3-tier `distributionPercent` selection.

No changes to `MultiRoutePanel.tsx`, `useAlcorPools.ts`, `swapApi.ts`, or transaction construction.
