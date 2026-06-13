# Fix: CHEESESwap "Failed to fetch" still showing & no longer self-healing

## Root cause

Alcor's `/api/v2/swapRouter/getRoute` intermittently fails the first call (CORS-shaped browser `TypeError: Failed to fetch` or HTTP 429). The current logic has two problems that together produce what you're seeing:

1. **Hard surface of the error.** `CheeseSwapWidget` shows the red banner whenever `routeError && !isRetrying && !routeLoading`. `isRetrying` is derived from `useSwapRoute` as `!!error && (isFetching || failureCount < 3)`. Between retry attempts React Query is *not* `isFetching` and `failureCount` can already equal the cap, so the banner flashes red and the swap button flips to "No route available" even though another attempt is still scheduled or possible.
2. **Retries give up too soon.** With the cap at 3 and 1s→2s→4s backoff, total recovery window is only ~7s. Alcor's transient window is often 15–30s, so the query exhausts retries before the API recovers — and because `staleTime: 15_000` keeps the failed result cached, the user sees a permanent failure until they change the input.

Also, browser fetch failures on Alcor commonly throw a bare `TypeError` whose `.message` is just `"Failed to fetch"` — already covered, but the UI logic above defeats the suppression.

## Fix (Alcor only — no provider changes)

### 1. `src/hooks/useSwapRoute.ts`
- Increase transient retry cap to **6** attempts (covers ~30s window) with backoff `1s, 2s, 4s, 8s, 12s, 15s` (capped 15s) for generic transient errors; keep 5s→30s backoff for explicit 429 `Rate limited`.
- Do **not** cache failures: set `retryOnMount: true` and add `throwOnError: false`. Most importantly, drop `staleTime` for error results by leaving `staleTime` on success only — React Query already refetches on next trigger when there's an error, but we add a manual safety net below.
- Replace the brittle `isRetrying` derivation with one that stays `true` for the entire retry window: `isRetrying = !!error && failureCount < MAX_TRANSIENT_RETRIES` for transient errors (ignore `isFetching`, since the gap between attempts is the exact moment the UI was flashing red).
- Distinguish error kinds in the return value: `transientError` (suppress in UI) vs `finalError` (show in UI). Only expose `finalError` as `error`.
- After exhausting retries on a transient error, schedule one delayed `refetch()` via `setTimeout` 20s later (cleaned up on unmount / query key change) so the widget self-heals like it used to, instead of being stuck.

### 2. `src/components/swap/CheeseSwapWidget.tsx`
- Render the red banner only when `error` is the new `finalError` (non-transient) **and** `!routeLoading` **and** `!isRetrying`. Transient failures never reach the banner.
- Swap button text precedence while hasAmount is true:
  1. `isSwapping` → "Swapping..."
  2. `routeLoading || isRetrying` → "Finding best route..."
  3. `noRoute` → "No route available"
  4. `finalError` → "Route unavailable — retry"
  5. `route` → "Swap"
- When state (4) is shown, clicking the button calls `refetch()` (exposed from the hook) so the user has an explicit recovery affordance in addition to the automatic 20s retry.

### 3. `src/lib/swapApi.ts` (small hardening, no behavior change for happy path)
- In `fetchSwapRoute`, wrap the `fetch(...)` call in `try/catch` and re-throw a normalized `Error("Failed to fetch swap route — network")` when the underlying error is a `TypeError`. This ensures the retry classifier in the hook matches reliably across browsers (Safari throws `"Load failed"`, Chrome `"Failed to fetch"`, Firefox `"NetworkError when attempting to fetch resource"`).
- Do **not** add any new endpoint, provider, debounce change, or transaction-path change.

## Verification

- With DevTools network throttling / blocking the first `getRoute` request: widget shows "Finding best route…" continuously, no red banner, then resolves to a real quote within the retry window.
- Forced permanent failure (block the endpoint entirely): after ~30s the widget shows "Route unavailable — retry" with a clickable button; clicking refetches.
- Genuinely unsupported pair returns `route: null` → "No route available" (unchanged).
- Successful path (WAX → CHEESE) unchanged: same debounce, same quote, same transaction.

## Out of scope
- No secondary route provider (per your decision).
- No changes to `swapTokens`, balances, or `normalizeRouteActions`.
- No UI restyle beyond the button label states above.
