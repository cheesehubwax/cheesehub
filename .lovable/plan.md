## Problem

`tradeCalculatorWASM` (from `@alcorexchange/alcor-swap-sdk`) is compiled as a CommonJS module that calls `require(...)` at init. In the browser bundle `require` is undefined, so every call to `Trade.bestTradeWithSplitWASM(...)` throws `ReferenceError: require is not defined` and the SDK logs `Failed to load WASM module` as an error.

Our current router in `src/lib/alcorRouter.ts` calls `bestTradeWithSplitWASM` first inside `runBestTradeWithSplit`, catches the throw, and falls back to the JS `bestTradeWithSplit`. With the recent changes we now call this multiple times per quote (dual-grid 1% + 5%, and per staged tick batch), which:

- Spams the console with WASM errors.
- Wastes time attempting a codepath that can never work in this environment.
- Contributes to the "crashing when trying to find best route" symptom.

## Fix

Stop attempting the WASM path in the browser and always use the JS implementation.

### Changes (single file: `src/lib/alcorRouter.ts`)

1. **Feature-detect once, cache the result.** At module scope add:
   - `let wasmDisabled = false;`
   - No probing call — we simply skip WASM after the first failure and never retry within the session.

2. **Rewrite `runBestTradeWithSplit`:**
   - If `wasmDisabled` is true, immediately call `T.bestTradeWithSplit(...)` (JS).
   - Otherwise attempt `T.bestTradeWithSplitWASM(...)` inside try/catch as today, but on any throw OR null result set `wasmDisabled = true` and log a single `logger.info("[alcor-router] WASM router unavailable in browser — using JS router")` message (guarded so we only log once).
   - Always fall back to `T.bestTradeWithSplit(...)` when WASM is unavailable or returned null.

3. **Suppress duplicate warnings.** Remove the per-call `logger.warn` lines inside `runBestTradeWithSplit` (they now fire N times per quote). Keep only the single one-time info log.

### Why this is the right scope

- The SDK's own `console.error("Failed to load WASM module", ...)` originates inside the SDK and can't be silenced from our code, but skipping the WASM call after the first failure prevents it from firing again in the same session.
- No behavioral change to routing math — the JS implementation is already the fallback we've been using.
- No changes needed in `useSwapRoute.ts` or `swapApi.ts`.

## Verification

1. Type-check clean.
2. Load the swap widget, enter an amount, and confirm the console shows the one-time `WASM router unavailable in browser — using JS router` info log and no repeated `Failed to load WASM module` errors from subsequent quote refreshes.
3. Confirm the multi-route panel still populates and picks the better of HTTP vs SDK split.

## Out of scope

- Actually shipping a browser-compatible WASM build of the Alcor trade calculator (would require bundling the `.wasm` under `public/wasm/` and shimming the SDK's loader — much larger change, not needed for correctness).
- Any changes to the tick-fetch queue, dual-grid split search, or HTTP fallback logic from the previous turn.