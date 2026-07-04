## Better routing parity with Alcor (drop hub allowlist)

Same 1000 WAX → CHEESE trade shows Alcor 3-way split (555.4163 CHEESE) vs. ours 2-way (554.4158). Root cause: `selectRelevantPools` restricts every intermediate hop to a hardcoded `HUB_KEYS` allowlist, so `computeAllRoutes` never sees the third path Alcor uses.

## Changes

### 1. `src/lib/alcorRouter.ts` — rewrite `selectRelevantPools`
- Drop `HUB_KEYS` entirely.
- Build adjacency over ALL active pools.
- Forward BFS from `tokenIn` (dIn) and reverse BFS from `tokenOut` (dOut), each limited to `maxHops`.
- A pool `(a,b)` is on some ≤maxHops path iff `dIn(a) + 1 + dOut(b) ≤ maxHops` OR the reverse — keep exactly those.
- Cap: always keep pools directly touching `tokenIn`/`tokenOut`. Rank the rest by `volumeUSD24` (with `volumeUSDWeek/7` and log-scale liquidity as tiebreakers), cap at 120 (up from 60).

### 2. `src/lib/alcorRouter.ts` — throttle tick fanout
- Add a `mapLimit(items, 8, fn)` helper.
- Replace the `Promise.all` tick-fetch in both `computeAlcorTrade` and `computeShadowQuote` with the limited version so we never burst >8 concurrent `/pools/:id/ticks` requests.
- Log the pool count (`relevant.length`) at info level so we can eyeball fanout in shadow logs.

### 3. `src/test/shadow.test.ts` — assertion
- Add: for `1000 WAX → CHEESE` expect `splits.length >= 2` and `output` within 0.5% of a locally-recorded Alcor baseline (loose enough to survive normal market drift).

## Safety
- HTTP fallback stays. If SDK returns nothing (or throws), we still return the public HTTP quote.
- No UI changes.
- No new npm dependencies.

## Files touched
- `src/lib/alcorRouter.ts`
- `src/test/shadow.test.ts`