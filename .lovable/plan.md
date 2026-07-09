# Fix: "No route available" on every swap

## Diagnosis

Console shows both sides of the router race failing with HTTP 429 (rate limited) on `wax.alcor.exchange`:

- SDK: `Error: Failed to fetch Alcor pools (429)` (from `fetchAllAlcorPools` in `src/lib/alcorRouter.ts`)
- HTTP: `Error: Rate limited — please wait a moment and try again` (from `fetchSwapRoute` in `src/lib/swapApi.ts`)

Both are caught in `useSwapRoute.queryFn` and converted to `null`. Because `Promise.all` resolves with two nulls, `queryFn` returns `null` (no route) — a **success** from React Query's perspective. So the widget shows "no route available" instead of retrying with the existing 5s·2^n backoff configured in `retryDelay`.

The recent TTL reduction (pools 30s→10s, ticks 30s→5s) plus the SDK+HTTP race doubling per-quote network fanout is what's driving the 429s. We need to (a) recover gracefully when we hit them, and (b) reduce how often we hit them.

## Changes

### 1. `src/lib/alcorRouter.ts` — surface 429 as a transient "Rate limited" error

In `fetchAllAlcorPools` and `fetchPoolTicks`, when `res.status === 429`, throw:

```
throw new Error("Rate limited — please wait a moment and try again");
```

for non-429 non-ok responses keep the existing "Failed to fetch …" message. This aligns SDK errors with `swapApi.fetchSwapRoute` so the retry-delay branch (`5000 * 2 ** attemptIndex`, capped 30 s) applies to SDK failures too.

### 2. `src/lib/alcorRouter.ts` — soften TTLs to reduce 429 pressure

- `POOLS_TTL_MS`: `10_000` → `20_000`
- `TICKS_TTL_MS`: `5_000` → `15_000`

Still fresher than the pre-change 30 s but half the request rate we're generating now. Pool membership and tick state don't move fast enough to justify aggressive re-fetching once the widget is quoting steadily.

### 3. `src/hooks/useSwapRoute.ts` — propagate transient failures so retry kicks in

Inside `queryFn`, capture each side as `Promise.allSettled` instead of `.catch(() => null)`:

- Track `sdkErr` / `httpErr` (rejection reasons, excluding `AbortError` which is rethrown as today).
- Compute `sdkResult` / `httpResult` from fulfilled values.
- After validity checks:
  - If `!sdkValid && !httpValid`:
    - If either error is transient (via the existing `isTransientError` helper — export or duplicate it locally), **throw the transient error** so React Query's `retry` + `retryDelay` handle it with the 5 s→30 s backoff.
    - Otherwise return `null` (genuine "no route", not a network glitch).
- Winner-selection logic when at least one side is valid stays unchanged.

Move `isTransientError` above `useSwapRoute` (already there) and reuse it inside `queryFn`.

### 4. Out of scope

- Router config (`maxSplits`, `distributionPercent`, WASM-first), pool selection, `MultiRoutePanel`, `normalizeRouteActions`, transaction execution, min-received clamp — untouched.

## Verification

1. Preview → `/testfarm2`, enter WAX→LSWAX @ 100.
2. Watch console:
   - If 429s occur: warnings appear, widget stays in "retrying" state (no red error banner, no "no route"), and a quote lands within ~10–30 s.
   - Otherwise: `[alcor-router] winner=SDK|HTTP …` logs as before.
3. Confirm quote is comparable to Alcor UI within a few basis points.
4. `bunx vitest run src/test/shadow.test.ts` still passes.
