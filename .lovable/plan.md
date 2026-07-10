# Restore CHEESESwap multi-routing

## What I found

Multi-routing code is fully wired end-to-end (SDK split router → `SwapSplit[]` with per-split memos → `MultiRoutePanel` UI → `normalizeRouteActions` emitting one transfer per split). It just almost never runs.

In `src/hooks/useSwapRoute.ts` the query does this:

1. Call Alcor's HTTP `/swapRouter/getRoute` (`fetchSwapRoute`).
2. If it returns any non-empty route with `memo` and `output > 0`, **return it immediately**.
3. Only if HTTP returns null/empty, fall back to `computeAlcorTrade` (the SDK split router).

Alcor's HTTP endpoint almost always returns a single-path route (its `swaps` array is usually one entry at 100%), so step 2 short-circuits and the split router never runs. That's why every quote appears to go 100% through one pair.

Additionally, `fetchSwapRoute` maps HTTP `swaps` without copying `memo`/`maxSent`, so even if HTTP ever did return multiple splits, `normalizeRouteActions` would fall back to the single-transfer path (its `allHaveMemos` check requires per-split memos).

## What to change

Goal: get true multi-split quotes back on the hot path when they meaningfully beat the single-pool HTTP quote, without regressing latency/rate-limiting for simple pairs.

### 1. `src/hooks/useSwapRoute.ts` — race HTTP and SDK, pick the better output

- Replace the "HTTP first, SDK only on null" logic with a bounded race:
  - Kick off `fetchSwapRoute(...)` and `computeAlcorTrade(...)` in parallel (both respecting the same `signal`).
  - Skip the SDK leg when `isAlcorCoolingDown()` is true (unchanged behavior during 429 backoff), so we don't worsen rate limiting.
  - `Promise.allSettled` both; then choose:
    - EXACT_INPUT: whichever has the larger `output` (and valid `memo`(s)).
    - EXACT_OUTPUT: whichever has the smaller `input` (fall back to HTTP if SDK doesn't return `input`).
  - Prefer the SDK result only when it has ≥2 splits AND is strictly better than HTTP by a small threshold (e.g. > 0.05% improvement) to avoid flip-flopping on ties.
  - If SDK errors/aborts, use HTTP. If HTTP errors and SDK is valid, use SDK. If both fail, propagate the error (transient classifier unchanged).

### 2. `src/lib/swapApi.ts` — preserve `memo`/`maxSent` on HTTP splits

In `fetchSwapRoute`, when mapping `rawSwaps`, also copy `memo` and `maxSent` if the endpoint provides them. This lets `normalizeRouteActions` emit multi-transfer execution when the HTTP router itself ever returns real splits.

### 3. Small guardrails

- Keep the debounce (350ms) and `staleTime` (15s) as-is.
- Keep `maxHops: 3` for both routers so quotes are comparable.
- Log (via `logger.info`) which router won and by how much, so we can confirm multi-splits are actually being selected in practice.

## Technical details

- No new deps; SDK router already imported.
- `computeAlcorTrade` already returns per-split `memo`, so `normalizeRouteActions`'s `allHaveMemos` branch (one transfer per split) will fire automatically when the SDK result wins.
- `MultiRoutePanel` already renders when `route.swaps.length > 1`, so the UI needs no change.
- Rate-limit safety: SDK leg is skipped during cooldown, matching current behavior; the pools/ticks caches (`POOLS_TTL_MS=20s`, `TICKS_TTL_MS=15s`) mean repeat quotes for the same pair reuse data without new fetches.

## Out of scope

- Changing `maxHops`, `distributionPercent`, or `minSplits/maxSplits` tuning.
- Touching WASM router selection (`runBestTradeWithSplit`).
- Any transaction-signing changes — multi-transfer path already exists and is exercised as soon as a multi-split route is chosen.
