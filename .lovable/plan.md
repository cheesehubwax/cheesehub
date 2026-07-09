# Speed up swap quoting

Goal: reduce perceived time-to-quote from 20+s to ~1–2s on the happy path, without weakening the 429 protections we just added or losing SDK-fallback correctness.

## Where the time actually goes today

For a normal quote the current path is:

```text
user types → 1200ms debounce → HTTP /swapRouter/getRoute
             (if that fails transiently) → 1s,2s,4s,8s,12s,15s backoff × up to 6 tries
             (if HTTP returns null) → fetch ALL pools + ticks for up to 400 pools
                                       at concurrency 4 → SDK route calc
```

The three real latency sources are:
1. The 1200ms debounce runs on **every keystroke**, so simple retypes stall for >1s before any network request starts.
2. Transient-retry ladder can add 30s on a flaky network even when the next call would have succeeded fast.
3. When HTTP returns an empty route, the SDK fallback fetches ticks for up to 400 pools with only 4-way concurrency — that alone can be 8–12s. Between quotes the widget also blanks the previous route while a new fetch is in flight.

## Fix

All changes are in the swap frontend/data layer. No contract, UX, or 429-protection changes.

### 1. `useSwapRoute.ts` — quicker start, keep previous route on screen
- Drop the debounce from **1200ms → 350ms**. This is the single biggest win: quotes start ~850ms sooner on every input.
- Use React Query `placeholderData: (prev) => prev` so the previously-fetched route stays visible while a new quote is fetching. The widget already shows a loader on the affected input — the route panel just won't blank/flicker anymore, and the swap button doesn't drop back to "Enter amount" mid-refresh.
- Tighten the transient-retry ladder:
  - `MAX_TRANSIENT_RETRIES: 6 → 3`
  - Non-rate-limit backoff: start at **300ms** and cap at **4s** (was 1s → 15s). Rate-limit backoff stays at 5s→30s so we don't provoke Alcor.
  - Self-heal timer after exhausted retries: **20s → 8s**.

### 2. `alcorRouter.ts` — make the SDK fallback fast enough to actually help
- Raise tick-fetch concurrency **4 → 10** (still well below what triggers 429s in practice; if it does, `markAlcorRateLimited` short-circuits the fallback exactly like today).
- Lower `selectRelevantPools` cap **400 → 120**. The endpoint-touching + hub-touching + liquidity-desc ranking already puts the useful pools first; the tail is almost always irrelevant to a 3-hop route.
- Warm start: on the module's first import, kick off `fetchAllAlcorPools()` in the background (fire-and-forget, respects cooldown). The pool list is the same 20s-TTL cache the SDK fallback and `useAlcorPools` already use, so when either one actually needs it the response is instant.

### 3. `useAlcorPools.ts` — don't block the route panel on it
- Keep `enabled` gated by cooldown (already done), but add `placeholderData: (prev) => prev` and reduce `staleTime`/`gcTime` so route detail chips render immediately from cache after the first quote instead of showing a skeleton on every requote.

### 4. `swapApi.ts` — no behavior change
- No changes needed; `fetchSwapRoute` already normalizes network errors and marks 429s.

## Expected result

- Happy path: keystroke → ~350ms debounce → 1 HTTP call → route rendered. Typical total ~700ms–1.5s.
- Transient failure path: worst case ~300 + 600 + 1200 ≈ 2.1s of retries before self-heal kicks in, vs. ~30s today.
- Rate-limited path: unchanged — cooldown still suppresses SDK fan-out.
- Refetches never blank the current route or the multi-route detail chips.

## Files touched

- `src/hooks/useSwapRoute.ts`
- `src/lib/alcorRouter.ts`
- `src/hooks/useAlcorPools.ts`

## Verification

- Open swap widget, type an amount, confirm one `/swapRouter/getRoute` per debounced change and a visible route within ~1s on a warm cache.
- Change the amount rapidly; confirm the previous route + multi-route panel stays on screen while the new quote is fetching.
- Simulate offline for 2s then back online; confirm the widget self-heals within ~8s without a red error banner flash.
