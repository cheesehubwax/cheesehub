## Goal
Stop CHEESESwap from triggering the Alcor 429 storm that is breaking swaps on the published GitHub Pages build (and also happens in preview, just less often because Alcor's rate limit is per-IP and the preview keeps fewer live pages open).

## Confirmed cause
`useSwapRoute` races two quote systems on every input change:

```text
CHEESESwap quote (on every debounce tick)
├─ Alcor HTTP router  → /swapRouter/getRoute        (1 request)
└─ Alcor SDK router   → /swap/pools + /swap/pools/{id}/ticks   (dozens–hundreds)
```

The SDK path fans out `Promise.all` fetches to every candidate pool's `/ticks` endpoint. That is exactly what your network log shows: many parallel `/swap/pools/{id}/ticks` → 429s and "Failed to fetch". Once Alcor rate-limits the IP, even the HTTP router call gets 429, so the widget shows retrying / no route.

The published site hits this harder because it stays open longer per session and doesn't share Vite's dev cache warm-ups.

## Plan

### 1. Make Alcor's HTTP router the primary quote path
- In `src/hooks/useSwapRoute.ts`, stop racing `computeAlcorTrade` and `fetchSwapRoute` in parallel.
- Call `fetchSwapRoute` first. If it returns a usable route, use it directly — no SDK call, no tick fan-out.

### 2. Use the SDK router only as a controlled fallback
- Only invoke `computeAlcorTrade` when the HTTP router returns a genuine empty route (not a 429 / network error).
- Skip SDK fallback entirely while a global Alcor cooldown is active (see step 3), so we never make the 429 problem worse.

### 3. Global Alcor cooldown after any 429
- Add a shared cooldown flag in `src/lib/alcorRouter.ts` / `swapApi.ts`.
- On any Alcor 429 (route, pools, or ticks), set the cooldown for ~30s.
- During cooldown: HTTP router requests still run (they're cheap and singular), but SDK tick fan-out and pool-detail fetches short-circuit instead of piling on.

### 4. Throttle SDK tick fetching (defensive)
- In `fetchPoolTicks` / `computeAlcorTrade`, replace the current `Promise.all` over every relevant pool with a small concurrency pool (e.g. 4 at a time).
- Briefly cache tick failures (a few seconds) so the same pool doesn't get retried immediately.
- Keep the existing successful-tick cache untouched.

### 5. Softer multiroute details
- `MultiRoutePanel` currently drives `useAlcorPools` which requests `/swap/pools/{id}` per hop. Keep this, but:
  - Skip fetching pool details while the Alcor cooldown is active — show a compact "route unavailable" line instead of retrying.
  - Reduce React Query retries on those calls so a 429 doesn't cascade into more requests.
- Never block quoting or swapping on pool-detail metadata (already true; verify).

### 6. Keep the good UX behaviors already in place
- Retain the existing `useSwapRoute` transient-error handling: retry backoff, "Route unavailable — retry" button, self-heal timer. These already handle 429 correctly once the fan-out is gone.

### 7. Verify
- Reproduce a WAX → CHEESE quote on the preview and on the published site.
- Network tab: only a single `/swapRouter/getRoute` per debounced input change, with no `/swap/pools/{id}/ticks` storm.
- Swap button reflects real state: "Finding best route…" → "Swap", or "Route unavailable — retry" only on genuine failures.
- CHEESESwap dialog title and Alcor attribution stay unchanged.

## What this does NOT change
- No changes to CHEESESwap branding, dialog title, disclaimer, terms, or the Alcor smart-contract attribution.
- No change to how transactions are actually built and signed (`normalizeRouteActions`, memo shape, per-split transfers).
- No new dependencies.