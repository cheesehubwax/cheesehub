## Plan: fix the visual, revert the routing churn

You're right — if the actual on-chain trade result was identical, the SDK route was correct on the very first quote. What's wrong is only the `MultiRoutePanel` rendering. The recent `alcorRouter.ts` / `useSwapRoute.ts` changes were treating a cosmetic issue as a routing bug and now add real cost (lower concurrency, extra retry storms, prewarm fan-out, `incompleteSdkRouteError` throws that keep a valid quote off screen).

### Root cause of the visual glitch

`MultiRoutePanel` walks each split's `route: number[]` and calls `pools.get(poolId)` from `useAlcorPools`. On the first quote:

- Pool metadata for some of those IDs isn't in the react-query cache yet.
- `useAlcorPools` has `enabled: !isAlcorCoolingDown()` and `retry: 0`, so some queries can be idle/loading/errored.
- The render loop hits a missing pool, sets `broken = true`, and stops mid-chain — producing the "wrong looking" multiroute.
- Its `isLoading` gate is `results.some(r => r.isLoading)`, which is false for disabled/idle/errored queries, so the skeleton doesn't cover this case.
- Seconds later the pool queries resolve, the map fills in, and the same underlying route renders correctly.

### Changes

1. **`src/components/swap/MultiRoutePanel.tsx`** — only render the chain once every pool in `allIds` is present in the `pools` map. While any pool is missing, show the existing skeleton (or nothing) instead of a broken chain. Don't render partial rows with `broken = true`.

2. **`src/hooks/useAlcorPools.ts`** — expose a stricter readiness flag:
   - `isReady = uniqueIds.every(id => pools.has(id))`
   - Keep `enabled: !isAlcorCoolingDown()` but give the pool metadata queries a small retry (e.g. `retry: 2`) so a single 429 doesn't leave the chain permanently broken.
   - Keep `placeholderData: prev` so a good render survives refetches.

3. **Revert the router/hook churn to the pre-issue behavior** (they were solving a problem that didn't exist):
   - `src/lib/alcorRouter.ts`
     - Restore tick-fetch concurrency to its previous value (10) — remove `QUOTE_TICK_CONCURRENCY=4` / `PREWARM_TICK_CONCURRENCY=2`.
     - Restore `TICKS_FAIL_TTL_MS` and remove the `TICKS_FETCH_RETRIES` retry loop unless it was already present before this issue.
     - Remove the `incompleteSdkRouteError()` guard in `computeAlcorTrade`. A route with `tickFailures > 0` but a valid output is still the correct quote; do not throw.
     - Remove `prewarmTicksForPair` if it was only added for this issue (and its export).
   - `src/hooks/useSwapRoute.ts`
     - Drop the `prewarmTicksForPair` effect.
     - Remove `"complete split route"` and `"ticks recently failed"` from `isTransientError`.
     - Remove the `sdk.quoteComplete === false` → throw branch. Accept the SDK quote as-is when it's valid.
     - Restore `MAX_TRANSIENT_RETRIES` and `retryDelay` to their pre-issue values (revert 6 → 3, restore original backoff).

4. **`.lovable/plan.md`** — replace with a short note that the previous plan misdiagnosed a visual-only issue.

### Verification

- Hard refresh, pick the same pair/amount you tested before.
- First rendered quote: output amount matches the "second" (correct-looking) render exactly. ✅ already confirmed by you.
- `MultiRoutePanel` shows a skeleton until all pool metadata for the route is fetched, then renders the full chain in one shot — no truncated/broken variant is ever visible.
- No first-quote "route unavailable" flashes, no `incompleteSdkRouteError` thrown, and normal tick-fetch concurrency is restored.
