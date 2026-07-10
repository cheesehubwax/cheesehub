## Symptom

1. First quote → red "Route unavailable — retry" banner (SDK retries exhausted).
2. User clicks retry → renders a partial split (image 1: direct-only pools, no intermediate hops).
3. User changes the amount and puts it back → correct multi-hop split (image 2).

We should show image 2 on the first render, without user intervention.

## Root cause

The plan we just shipped correctly throws when `sdk.quoteComplete === false`, but the react-query retry budget can't outlast Alcor's 429 storm on a cold fresh-pair quote:

1. `computeAlcorTrade` fans out ~40–56 tick requests at concurrency=10. Alcor rate-limits several of them.
2. Each 429 stamps the pool in `ticksFailCache` for **`TICKS_FAIL_TTL_MS = 8s`** (`src/lib/alcorRouter.ts`). During that 8 s window every retry immediately throws `"ticks recently failed for pool N"` **without hitting the network** — the negative cache short-circuits the recovery we're relying on.
3. React-query retries with backoff 300 ms → 600 ms → 1.2 s (total < 2.1 s) then declares `exhaustedTransient`. The 8 s negative cache hasn't even expired yet, so all three retries return the *same* partial pool set. Banner flips to "Route unavailable — retry".
4. The 8 s self-heal timer eventually fires (or the user clicks retry). By then some — but not all — negative-cached pools have expired, so we get a *different* partial (image 1: only the direct LSWAX↔CHEESE pools built, no intermediate hops). That partial still fails the completeness check, so it either throws again or, if the surviving `tickFailures === 0` by coincidence for the reduced pool set, renders as image 1.
5. Changing the amount forces a fresh query key. By this time the negative cache has fully expired, ticks refetch cleanly, and image 2 lands.

The retry loop is racing an 8 s cooldown with a ~2 s budget. It can't win.

## Fix

Three coordinated changes so the first quote returns the complete route without the user seeing the retry banner. All in `src/lib/alcorRouter.ts` and `src/hooks/useSwapRoute.ts`. No changes to routing math, grid, or executed transaction.

### 1. Shorten the tick negative cache and add in-request retries

In `src/lib/alcorRouter.ts`:

- Drop `TICKS_FAIL_TTL_MS` from `8_000` to `1_500`. 8 s made sense as a hammer guard; 1.5 s is enough to break a tight retry loop but still avoids re-hitting the same pool inside one fan-out.
- In `fetchPoolTicks`, on a non-abort failure (429 or transient), retry the fetch up to **2 times** with 400 ms / 900 ms backoff **before** stamping `ticksFailCache` and throwing. This turns each tick fetch into its own small retry budget so a single 429 in the fan-out no longer poisons a pool for the rest of the query.
- Keep 429 → `markAlcorRateLimited()` behavior; the global cooldown still throttles *new* SDK fan-outs, but individual tick recovery inside an already-in-flight fan-out is allowed.

### 2. Give the hook enough retry budget to outlast a 429 burst

In `src/hooks/useSwapRoute.ts`:

- Raise `MAX_TRANSIENT_RETRIES` from `3` to `6`.
- Adjust `retryDelay` so the non-rate-limit path is `500 ms → 1 s → 2 s → 3 s → 4 s → 4 s` (cap 4 s). Total budget ~14 s — comfortably longer than Alcor's typical 429 recovery and longer than the new 1.5 s negative-cache window, so a genuinely incomplete SDK trade gets refetched instead of surfacing as image 1.
- Leave the rate-limit branch (`msg.includes("Rate limited")`) with its longer `5000 * 2^n` backoff untouched.

### 3. Prewarm tick cache on token selection

Also in `src/lib/alcorRouter.ts`, export a `prewarmTicksForPair(tokenIn, tokenOut, maxHops)` helper that:

- Skips work if `isAlcorCoolingDown()`.
- Runs `selectRelevantPools` on the cached `poolsCache` (does nothing if pools aren't cached yet — the module-import warm-up handles that).
- Fires tick fetches at concurrency=4 (lower than the quote's 10 to avoid stealing from an in-flight quote) and swallows errors. This is best-effort cache warm-up, not a quote.

Call it from `useSwapRoute.ts` inside a `useEffect` keyed on `tokenIn?.contract`, `tokenIn?.ticker`, `tokenOut?.contract`, `tokenOut?.ticker` (fires as soon as both tokens are picked, before the user finishes typing an amount). By the time the debounced amount hits `queryFn`, most tick data is already in `ticksCache` and the SDK returns `quoteComplete: true` on the first attempt.

## Why this is safe

- No change to `computeAlcorTrade`'s decision logic, the $30 grid, `maxHops`, pool cap, `minSplits`/`maxSplits`, or the memo/transaction shape.
- If Alcor is genuinely down, the hook still exits via `exhaustedTransient` after 6 retries and the existing 8 s self-heal timer kicks in — same UX as today, just later.
- The prewarm effect is idempotent and swallows errors, so it can't produce a user-visible failure.
- Negative-cache-window shrink from 8 s → 1.5 s: worst case is one extra 429 on a genuinely broken pool inside a single fan-out, and the new per-request retry already cushions that.

## Validation

1. Hard-reload the widget. Pick LSWAX → CHEESE, enter 1000. The first rendered quote should already be image 2 (multi-hop with 0.3% intermediate fees), with no red "Route unavailable" banner in the interim.
2. Console should show either zero `SDK route incomplete; retrying` warnings, or at most one before `SDK won …` lands.
3. Change tokens to a different fresh pair — same behavior: complete route on first render.
4. Manually trigger a 429 storm (throttle Alcor) and confirm the hook still eventually falls back to `exhaustedTransient` → 8 s self-heal, not an infinite spinner.

## Non-goals

- Not touching `alcorRouter.ts` routing logic, pool selection, or trade construction.
- Not changing the executed transaction shape or slippage handling.
- Not changing the multiroute UI rendering (`MultiRoutePanel`).
