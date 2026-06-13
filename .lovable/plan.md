## Problem

When swapping CHEESE → WAXWBTC, the Alcor route endpoint (`/api/v2/swapRouter/getRoute`) intermittently returns a network error or 429 rate-limit on the first attempt. The widget immediately shows the red "Failed to fetch" alert under the inputs and disables the Swap button. React Query then retries with backoff and ~30s later the route resolves and the swap becomes available. The fetch is actually self-healing — only the UX is broken.

## Fix (UI-only, no contract / business logic changes)

Two small, focused edits:

### 1. `src/hooks/useSwapRoute.ts`
- Treat generic network errors ("Failed to fetch", `TypeError`, `AbortError` from network) the same as rate-limit errors: retry up to 3 times with exponential backoff (1s → 2s → 4s, capped). Currently only `Rate limited` messages retry more than once; bare "Failed to fetch" retries only once which leaves the user staring at a red error.
- Expose `failureCount` (already on the query result) so the widget can distinguish "transient, still retrying" from "final failure".
- Return a derived `isRetrying` boolean: `true` when there is an error AND the query is still fetching/will retry.

### 2. `src/components/swap/CheeseSwapWidget.tsx`
- Hide the red `routeError` banner while `isRetrying` is true OR while `routeLoading` is true. Only show the red banner after retries are exhausted (final failure) or when `noRoute` is true with a clear "No route available for this pair" message.
- While retrying, keep the existing subtle "Finding best route..." label on the Swap button (already implemented) so the UI looks like it's just working, not failing.
- Leave the actual swap action, route-fetch parameters, and Alcor endpoints untouched.

## Out of scope

- No changes to `swapApi.ts` request shape, Alcor endpoints, debounce timing, or transaction signing.
- No changes to other widgets that consume Alcor data.

## Verification

- Open Alcor swap dialog, select CHEESE → WAXWBTC, type an amount.
- Throttle network or trigger a 429 in DevTools: red banner should NOT appear; button shows "Finding best route…" until route resolves, then becomes "Swap".
- Genuinely unsupported pair: red "No route available" still shows after retries are exhausted.
