# Match Alcor's multi-route output in CHEESESwap

## Problem
Our SDK router (`src/lib/alcorRouter.ts`) is quoting from a tiny slice of the pool universe, so it returns fewer/worse splits than wax.alcor.exchange. The Alcor UI screenshot shows a 3-way split through several non-hub tokens; ours picks a single 100% path because those pools are filtered out before quoting.

Root cause is in `selectRelevantPools`: it only keeps a pool when **both** sides are in a hardcoded 7-token `HUB_KEYS` set (plus tokenIn/tokenOut). Alcor's real router has no such whitelist — it considers every active pool and lets `computeAllRoutes` + `bestTradeWithSplit` prune.

## Fix (single file: `src/lib/alcorRouter.ts`)

1. **Drop the hub whitelist for pool selection.** Replace the `anchors`-based filter with: keep every active pool, then run the existing BFS (bounded by `maxHops`) starting from `tokenIn` to find every token reachable within `maxHops` hops. Keep only pools whose both endpoints are reachable and where at least one endpoint sits on some tokenIn→…→tokenOut path of length ≤ maxHops. This mirrors Alcor's approach: the SDK's `computeAllRoutes` does the real pruning; our job is just to feed it the right pool set.

2. **Increase the pool cap.** Bump `cap` from `60` to `200` (Alcor typically has ~150–250 active pools total, so this effectively removes the cap while keeping a safety ceiling for the ticks fan-out).

3. **Keep `HUB_KEYS` only as a tiebreaker for the cap.** When we do have to truncate to `cap`, prefer pools that (a) touch tokenIn or tokenOut directly, then (b) touch a known hub, then (c) fall back to liquidity-desc. This preserves connectivity when the universe is huge.

4. **No changes to** `maxHops` (3), `distributionPercent` (5), or `maxSplits` (4) — these already match Alcor's defaults.

5. **No changes to** `computeShadowQuote`, `computeAlcorTrade` return shape, `useSwapRoute`, `normalizeRouteActions`, or the widget. The fix is a pure pool-selection widening.

## Technical detail

In `selectRelevantPools`:

```text
before:
  anchors = {tokenIn, tokenOut} ∪ HUB_KEYS
  candidates = active pools where BOTH sides ∈ anchors
  BFS over candidates to verify tokenIn→tokenOut reachable in ≤maxHops
  sort by liquidity, slice to 60

after:
  candidates = all active pools
  BFS from tokenIn over the full graph, bounded by maxHops, to compute
    dist(token) for every token reachable ≤maxHops from tokenIn
  keep pools where dist(a) + dist(b, from tokenOut side via reverse BFS) fits
    within maxHops (i.e. the pool can lie on some ≤maxHops path)
  if pools.length > 200:
    rank by (touches tokenIn/out ? 0 : touches hub ? 1 : 2), then by liquidity desc
    slice to 200
```

Reverse BFS from `tokenOut` is cheap (same graph) and lets us keep only pools that plausibly participate in a tokenIn→tokenOut route, not every pool the SDK would otherwise enumerate.

## Verification

- Load `/testfarm2`, open the swap dialog with LSWAX → WAX at amount 100, and confirm the `MultiRoutePanel` shows multiple splits with fees comparable to Alcor's UI (`0.05%` / `0.3%` tiers, 2–3 splits).
- Check console: `[alcor-router] SDK quote used` should log `splits: >1` for pairs where Alcor's UI also splits.
- Run `bunx vitest run src/test/shadow.test.ts` — the shadow test compares SDK output vs Alcor's HTTP endpoint; parity should improve, not regress.
- Sanity: WAX ↔ CHEESE (single deep pool) should still return `splits: 1` and the same output as today.

## Out of scope
- No changes to memo format, action normalization, or transaction execution — those already handle multi-split correctly (see `normalizeRouteActions`).
- No UI changes.
