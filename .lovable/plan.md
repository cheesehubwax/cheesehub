# Close the SDK↔Alcor output gap

## Observation
Same query (100 WAX → LSWAX, 1% slippage, same instant):
- Alcor: **83.82339120** LSWAX
- Ours: **83.62655131** LSWAX (Δ ≈ 0.2 LSWAX / 0.24% worse)

Our price impact (0.25%) is *lower* than Alcor's (0.64%) despite worse output. That signature means the routing math is fine — our pool state is stale, and/or our SDK-selected paths differ from what Alcor's live server sees.

## Root causes

1. **Stale pool + tick caches.** `POOLS_TTL_MS` and `TICKS_TTL_MS` are both `30_000 ms` in `src/lib/alcorRouter.ts`. WAX produces a block every 0.5s → up to ~60 blocks of state drift.
2. **We prefer SDK output even when the HTTP route is better.** In `src/hooks/useSwapRoute.ts` we return the SDK quote whenever it produces a route, and only fall back to `fetchSwapRoute` (Alcor's live HTTP router) on error/empty. Alcor's HTTP endpoint always runs against fresh state and is effectively the upper-bound quote.

## Fix

### 1. Race SDK vs HTTP, pick better (`src/hooks/useSwapRoute.ts`)

Change `queryFn` to run both in parallel:

```text
const [sdk, http] = await Promise.allSettled([
  computeAlcorTrade({...}),
  fetchSwapRoute(tokenIn, tokenOut, ..., tradeType),
]);
```

Then pick:
- If only one succeeded with a non-null route → use it.
- If both succeeded, compare on the *user-visible* axis:
  - `EXACT_INPUT`: prefer the higher `output`.
  - `EXACT_OUTPUT`: prefer the lower `input`.
- Preserve the loser only for diagnostics; return the winner exactly as today so the widget consumes it unchanged.

Both branches already return `SwapRoute` — no shape adapter needed. Memo compatibility is preserved because we return the winner's own memo(s):
- HTTP winner → single aggregate memo, one transfer action (already works — `normalizeRouteActions` falls through to the legacy single-transfer path when splits lack memos).
- SDK winner → per-split memos, multi-transfer actions (already works — see `normalizeRouteActions`'s `allHaveMemos` branch).

Log which side won and by how much so we can measure parity in the console:
```text
[alcor-router] winner=SDK|HTTP output(sdk)=X output(http)=Y Δ=Z%
```

Abort handling: propagate `AbortError` from either branch untouched. If both fail with transient errors, throw the first (existing retry classifier will kick in).

### 2. Freshen pool/tick caches (`src/lib/alcorRouter.ts`)

- Drop `POOLS_TTL_MS` from `30_000` → `10_000`. Pool list membership rarely changes; state on each pool does.
- Drop `TICKS_TTL_MS` from `30_000` → `5_000`. Ticks are the fast-moving state.
- Keep the in-flight dedupe (`poolsInflight`/`ticksInflight`) so concurrent quote calls in the same debounce window still share a single fetch.

These caps still shield the API from over-fetching (React Query's own `staleTime: 15_000` in `useSwapRoute` is unchanged, so we're not multiplying request volume — just letting the first fetch inside a fresh window see newer state).

### 3. No changes to
- `selectRelevantPools` / pool universe (last turn's widening is fine).
- Router config (`maxSplits: 10`, `distributionPercent: 2`, WASM-first).
- `MultiRoutePanel` visual.
- `normalizeRouteActions`, transaction execution, swap button, retry logic.

## Verification

1. Load `/testfarm2` → open swap → WAX → LSWAX @ 100. Compare our output to Alcor's UI at the same instant; expect equality within a few basis points (should now match Alcor exactly when HTTP wins, or beat it when SDK wins on splitting).
2. Open the console, watch for `[alcor-router] winner=…` lines. Try a few pairs:
   - WAX ↔ LSWAX (deep, multi-pool — expect either side can win)
   - WAX ↔ CHEESE (single pool — expect SDK==HTTP)
   - LSWAX ↔ CHEESE (multi-hop — expect SDK often wins with better splits)
3. Confirm `Min. Received` ≤ `You receive` on every quote (existing clamp from last turn holds).
4. `bunx vitest run src/test/shadow.test.ts` still passes.

## Out of scope
- No memo format changes, no execution path changes, no UI changes beyond the console log.
- No new endpoints or connectors — Alcor's public HTTP router is already in the codebase (`fetchSwapRoute`).
