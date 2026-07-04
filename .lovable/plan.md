# Fix: split router is missing the WAXCASH hub

## Diagnosis

Alcor's UI is routing WAX→CHEESE partially through **WAXCASH** (`graffitiking`) — one of the deepest liquidity hubs on WAX right now:

- Pool 8388 WAX/WAXCASH — liq `1.6e15`
- Pool 9204 WAX/WAXCASH — liq `2.9e14`
- Pool 10933 CHEESE/WAXCASH — liq `1.7e12`

We are **not** seeing these pools. In `src/lib/alcorRouter.ts`, `selectRelevantPools` restricts candidates to pools where **both** tokens are in a hard-coded `HUB_KEYS` set (plus tokenIn/tokenOut). Today `HUB_KEYS` is:

```
wax, usdt.alcor, usdc.alcor, waxusdc, waxusdt, usdc(tether), lswax
```

WAXCASH (and NBG, MOONBOY, etc.) aren't in that set, so every pool that would hop through WAXCASH is filtered out before `computeAllRoutes` ever runs. That's why our quote is worse than Alcor's — Alcor's own router doesn't hard-code hubs; it picks pools by liquidity.

Extra symptom: the 60-pool `cap` and the "both endpoints must be anchors" filter compound the problem — even if we added WAXCASH, other emerging hubs would still be missed later.

## Fix (two-step, still Phase 2 scope — no execution changes)

### 1. Add WAXCASH to the static hub set (immediate parity)

In `src/lib/alcorRouter.ts` `HUB_KEYS`, add:

```
waxcash-graffitiking
nbg-gkniftyheads     // deep WAXCASH pairs, common 2-hop bridge
```

This alone restores the CHEESE/WAX→WAXCASH→CHEESE split path.

### 2. Replace the static hub gate with a liquidity-driven candidate set (durable fix)

Refactor `selectRelevantPools` so the "both endpoints in `HUB_KEYS`" rule becomes a fallback, not the primary filter:

1. Start with `active` pools.
2. Keep every pool that touches `tokenIn` or `tokenOut` directly (1-hop pools always in).
3. For 2- and 3-hop candidates, keep pools whose **both** tokens rank in the **top N (default 25) by aggregate liquidity across all active pools** — computed once from the same `/swap/pools` response. This is exactly the heuristic Alcor's SDK examples use (`topN` liquid tokens) and it auto-tracks new hubs (WAXCASH today, whatever emerges tomorrow) without code changes.
4. Union with the current `HUB_KEYS` set so the curated list still short-circuits obvious hubs.
5. Raise `cap` from 60 → 120. Ticks are fetched in parallel and cached; the extra latency is bounded and only paid on the first quote per session.
6. Keep the BFS connectivity check unchanged so we don't ship unreachable pools to the SDK.

### 3. Verify

- Manual: run a WAX→CHEESE quote in the widget, confirm MultiRoutePanel now shows a WAXCASH leg matching Alcor's UI split.
- Test: extend `src/test/shadow.test.ts` — assert that for WAX→CHEESE at 100 WAX, the returned `splits` include at least one route whose `path` contains `WAXCASH`, and that `totalOutput` is ≥ the current 100%-single-route baseline.

## Technical notes

- No changes to `swapApi.ts`, `useSwapRoute.ts`, or execution — memo builder and per-split transfer already work; they were just being fed too few routes.
- `computeAllRoutes(inTok, outTok, sdkPools, maxHops=3)` cost scales with `pools^maxHops`; 120 pools × 3 hops is still well within the SDK's tested envelope (Alcor itself runs ~150 pools client-side).
- Aggregate-liquidity ranking uses the same `BigInt(pool.liquidity)` we already sort by; no new API calls.
- Falls back gracefully: if `/swap/pools` returns nothing new, behavior collapses to today's curated hub list.
