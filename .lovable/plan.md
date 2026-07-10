## Problem

After the WASM router correctly falls back to JS (single log confirms it), the query hangs on "finding best quote". Two compounding causes:

1. **`useSwapRoute` waits for both engines.** `Promise.allSettled([http, sdk])` blocks until the SDK resolves. When the SDK is slow, the fast HTTP quote can't render.
2. **The JS split router is heavy.** With the recent changes we now call `T.bestTradeWithSplit` up to 2× (fine + coarse grid) per staged tick batch (up to 8 batches × 12 pools). On ~96 pools with up to 10-hop routes, the JS solver can run for tens of seconds and starves the UI.

## Fix

Introduce a hard time budget for the SDK and let HTTP fill the UI when SDK exceeds it. Also trim redundant work inside the SDK path.

### `src/lib/alcorRouter.ts`

1. **Overall SDK time budget.** At the top of `computeAlcorTrade` capture `started`; add `const SDK_BUDGET_MS = 8_000`. In the staged tick-batch loop, break as soon as `performance.now() - started > SDK_BUDGET_MS`, marking `completedAllTicks = false`. If we already have a `bestEval`, return that partial quote (`quoteComplete: false`); if not, return `null` (so HTTP wins) — do NOT throw.
2. **Per-`runBestTradeWithSplit` timeout.** Wrap each grid call in a `Promise.race` with a 3.5s per-call timeout that resolves to `null` (not reject) so `evaluatePools` still returns any grid winner that did finish. Log once per timeout with `logger.warn`.
3. **Drop the coarse grid until the fine grid succeeds at least once.** Only run the second (5%) grid on the final batch when we have time budget remaining — the dual-grid comparison is a safety net, not needed inside every intermediate batch.
4. **Reduce intermediate `evaluatePools` cost.** Only call `evaluatePools` after (a) the first batch that produced at least one built pool and (b) the final batch. Intermediate batches just accumulate pools. This preserves early-exit under rate-limits without paying for a full solve per batch.
5. **Do not throw on incomplete SDK when HTTP can win.** Change the "no bestEval + tickFailures>0" path to return `null` (with diagnostics attached to a warn log) instead of `throw incompleteSdkRouteError`. `useSwapRoute` already handles `null` by falling back to HTTP.

### `src/hooks/useSwapRoute.ts`

6. **Race SDK against a small grace window.** Keep both promises but wrap the SDK in a race: if `http` resolves and the SDK hasn't after `HTTP_GRACE_MS = 1_500`, proceed with what we have (SDK slot becomes `null`). If HTTP fails, wait full SDK budget. Concretely:
   - Start both.
   - `await Promise.race([httpPromise, timeout(HTTP_GRACE_MS)])`.
   - If HTTP resolved valid, `await Promise.race([sdkPromise, timeout(HTTP_GRACE_MS)])` — accept whatever SDK has by then; if not resolved treat as `null`.
   - If HTTP not valid yet, `await Promise.allSettled([...])` as today (bounded by the SDK's own 8s budget from step 1).
7. **Keep existing selection logic.** Once both slots are known (valid or `null`), the current pickSdk / splitLosesToSingleLeg / HTTP-fallback path stays unchanged. The result set for the UI is the same; only the waiting behavior changes.
8. **Do not abort in-flight SDK on grace timeout.** Let it keep computing so subsequent refreshes benefit from cached ticks and warm pool objects, but ignore its result for this query.

### Deliberately unchanged

- Split-search "best result wins" semantics: fine grid 1% remains the default; coarse grid still competes when reached.
- Rate-limit queue and cooldown behavior in `fetchPoolTicks`.
- Multi-transfer memo generation and HTTP fallback selection in `swapApi.ts`.

## Verification

1. Type-check clean.
2. Reproduce the stuck-loading case: quote should appear within ~1.5s (HTTP) even if SDK is still working. Console shows exactly one WASM fallback line, then either `SDK won (…)` or `HTTP won after SDK check` — never silent for 10+ seconds.
3. On slow/rate-limited runs, confirm `SDK budget exceeded — using HTTP fallback` warning and that the UI still renders a valid quote.
4. Confirm the multi-route panel still displays when the SDK does beat HTTP.

## Technical notes

- The WASM error message text has changed (`TextEncoder2 is not a constructor` instead of `require is not defined`) but the `wasmDisabled` gate already catches any throw, so no additional handling is needed there.
- No new dependencies. All timeouts use `setTimeout` inside a small `withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T>` helper co-located in `alcorRouter.ts`.