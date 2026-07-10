## Root cause

On the very first quote for a fresh pair, `computeAlcorTrade` fans out tick requests for every relevant pool in parallel. Some of those tick fetches fail on the first attempt (429 rate limits, negative-cache TTL, transient network). The SDK still produces *a* trade from whichever pools did build, and sets `quoteComplete: false` + `tickFailures > 0` on the result.

In `useSwapRoute.ts`, the "retry until complete" gate is only reached when SDK **loses** to HTTP:

```ts
if (pickSdk()) {
  // ...
  return { ...sdk!, quoteComplete: true };   // ← forced true, even if tickFailures>0
}

if (sdk && sdk.quoteComplete === false) {    // ← only checked in the losing branch
  throw retryError;
}
```

So when the incomplete SDK trade happens to beat HTTP (common — even a partial split usually beats the 100% HTTP route), we return it immediately and stamp `quoteComplete: true`. The widget renders the coarse/wrong multiroute. ~15–30s later react-query goes stale, the tick cache is now warm from the first attempt, the retry produces a *complete* split, and the widget "self-heals" to the proper routing.

## Fix

Treat an incomplete SDK trade as retry-worthy regardless of whether it beats HTTP. Only accept the SDK immediately when its `tickFailures === 0` (i.e. `quoteComplete !== false`).

### Change in `src/hooks/useSwapRoute.ts`

Reorder the decision so completeness is checked *before* the pickSdk short-circuit:

```ts
// If the SDK produced a trade but some ticks failed, its splits are known
// to be suboptimal — retry so the cache warms and we get the full routing.
if (sdk && sdk.quoteComplete === false) {
  const diag = sdk.quoteDiagnostics;
  const retryError = new Error(
    `Failed to fetch complete split route — retrying (${diag?.routesConsidered ?? "?"} routes, ${diag?.poolsBuilt ?? "?"}/${diag?.relevantPools ?? "?"} pools, tickFailures=${diag?.tickFailures ?? 0})`,
  );
  logger.warn("[alcor-router] SDK route incomplete; retrying regardless of HTTP comparison", retryError);
  throw retryError;
}

if (pickSdk()) { ... return SDK ... }
```

The existing transient-retry machinery (`MAX_TRANSIENT_RETRIES=3`, exponential backoff 300ms→4s cap) handles this — `isTransientError` already matches "Failed to fetch complete split route" via the "Failed to fetch" substring.

### Why this is safe

- If `tickFailures === 0` on the first attempt (common when the pool list is small or cache is warm), nothing changes.
- If retries exhaust (`MAX_TRANSIENT_RETRIES`), the existing `exhaustedTransient` path already kicks in: the button becomes "Route unavailable — retry" and the self-heal timer schedules another attempt in 8s. In practice the tick cache warms up in one or two retries.
- HTTP fallback is still available: after we exhaust SDK retries, the query has failed transiently — but the same flow that shows the retry button will re-run and the retry will find a healthy SDK trade (or fall through to HTTP naturally the next time SDK produces `quoteComplete: true` but worse than HTTP).

## Non-goals

- No change to the $30 grid gating.
- No change to `maxHops`, pool cap, `minSplits`/`maxSplits`.
- No change to `alcorRouter.ts`; this is a routing-decision fix in the hook.

## Validation

1. Hard-reload the widget, quote a fresh pair (e.g. LSW → CHEESE with 1000 LSW). First rendered quote should already show the correct multi-split (not the 80/10/5/5 placeholder-looking split).
2. Console should show one `[alcor-router] SDK route incomplete; retrying …` warning followed by `[alcor-router] SDK won …` — no user-visible flicker beyond the normal loading spinner.
3. Second and subsequent quotes of the same pair should still be instant (tick cache warm, no retries triggered).
