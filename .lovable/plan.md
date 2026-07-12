# Fix: CheeseSwap missing WAXBTC leg in WAX → WAXWBTC split

## Symptom

Trades that pass through hub tokens (CHEESE, USDC, LSWAX) split correctly and often beat Alcor slightly. Only **WAX → WAXWBTC** collapses to a single 100% route (0.00003247) instead of Alcor's 50/50 split (0.00003252).

Alcor's split goes:

- 50% WAX → **CHEESE** → WAXWBTC
- 50% WAX → **WAXBTC** → WAXWBTC

CheeseHub only ever sees the first leg.

## Root cause

In `src/lib/alcorRouter.ts` → `computeAlcorTrade`:

```ts
const tickResults = await mapWithConcurrency(relevant, TICK_CONCURRENCY, async (p) => {
  try { return { p, ticks: await fetchPoolTicks(p.id, signal) }; }
  catch (e) { tickFailures++; ...; return { p, ticks: [] as RawAlcorTick[] }; }
});

const sdkPools = tickResults
  .filter((r) => r.ticks.length > 0)   // ← silently drops pools with 0 ticks
  ...
```

WAXBTC pools (WAX/WAXBTC and WAXBTC/WAXWBTC) are the least resilient link in the graph:

- Low TVL → sparse initialized-tick table.
- Endpoint pools (not hubs) → they're fetched at the tail of the concurrency queue, so more likely to hit a 429.
- Any single tick-fetch failure or rate-limit → `ticks = []` → the pool is filtered out entirely → the WAXBTC route vanishes → SDK returns a 1-route quote → strict `>` tiebreak against HTTP fails → HTTP's 100% route renders.

Hub-routed trades never hit this because CHEESE/USDC/LSWAX pools always return non-empty ticks.

## Fix

Three surgical changes in `src/lib/alcorRouter.ts`, all inside `computeAlcorTrade` and its shared helpers. No smart-contract, memo, or UI changes.

### 1. Retry tick fetches once before giving up

Wrap the per-pool tick fetch in a bounded retry so a transient 429/network error doesn't permanently drop a pool from the graph. Add a small jittered delay before the retry so we don't immediately re-trigger the same rate-limit window.

```ts
async function fetchPoolTicksWithRetry(id: number, signal?: AbortSignal): Promise<RawAlcorTick[]> {
  try {
    return await fetchPoolTicks(id, signal);
  } catch (e) {
    if ((e as any)?.name === "AbortError") throw e;
    // Small jittered backoff, then a single retry.
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
    return await fetchPoolTicks(id, signal);
  }
}
```

Use it in place of `fetchPoolTicks` inside both `computeAlcorTrade` and `computeShadowQuote`.

### 2. Prioritise low-liquidity endpoint pools in the fetch queue

`selectRelevantPools` already returns pools in a good ranking order (direct → endpoint-hub → hub-hub → endpoint → hub → other). `mapWithConcurrency` consumes in that order, so endpoint pools with a non-hub partner (WAX/WAXBTC, WAXBTC/WAXWBTC) currently sit in the classRank=3 tier — behind endpoint-hub pools. That's already fine, but we should confirm the concurrency limit isn't starving them.

- Keep `TICK_CONCURRENCY` as-is (don't raise — that's what triggers 429s).
- No code change needed here beyond confirming with the diagnostic logs.

### 3. Log when a route was dropped due to missing ticks

Add a diagnostic so future WAXBTC-style regressions are visible immediately instead of manifesting as "quote is a bit worse."

After building `sdkPools`, compare the tokens present in `sdkPools` against `relevant` and log the delta:

```ts
const droppedForTicks = tickResults.filter((r) => r.ticks.length === 0).map((r) => r.p.id);
if (droppedForTicks.length > 0) {
  logger.warn(`[alcor-router] Dropped ${droppedForTicks.length} pool(s) with 0 ticks after retry`, droppedForTicks);
}
```

Also surface `droppedForTicks.length` in `quoteDiagnostics`:

```ts
const diagnostics: SwapRoute["quoteDiagnostics"] = {
  relevantPools: relevant.length,
  poolsBuilt: sdkPools.length,
  routesConsidered: routes.length,
  tickFailures,
  rateLimitedTickFailures,
  poolsDroppedNoTicks: droppedForTicks.length, // new
  tookMs: Math.round(performance.now() - started),
};
```

Add the field to the `SwapRoute["quoteDiagnostics"]` type in `src/lib/swapApi.ts`.

### 4. (Optional, only if step 1 doesn't fully fix WAXBTC) Loosen the SDK-vs-HTTP tiebreak

Currently `useSwapRoute` picks SDK only when `sdk.output > http.output`. If the retry succeeds but the split's improvement is smaller than one unit of the output token's precision (WAXWBTC is 8 decimals — very fine, so this shouldn't trigger), the tie would still go to HTTP.

**Do not change this yet.** The strict `>` is correct behaviour when both quotes are trustworthy. We only reconsider if diagnostics show the retry landed a valid WAXBTC route but its output still ties HTTP.

## Verification

1. Open CheeseSwap, WAX → WAXWBTC, 500 WAX.
2. Console should show either:
   - `[alcor-router] SDK won (2 splits, +…%, …)` with output ≈ 0.00003252, **or**
   - `[alcor-router] Dropped N pool(s) with 0 ticks after retry` — if this appears, WAXBTC is genuinely returning empty ticks and the retry couldn't recover; escalate.
3. Re-test WAX → CHEESE, WAX → USDC, WAX → LSWAX — must continue to split as before (no regression).
4. Re-test a large trade (100k WAX → CHEESE) — quote latency should stay under ~1 s.

## Out of scope

- No change to `distributionPercent` tiering (other trades split fine, so the grid is already adequate).
- No change to pool selection cap, memo shape, or execution path.
- No change to the HTTP fallback or SDK-vs-HTTP tiebreak.
