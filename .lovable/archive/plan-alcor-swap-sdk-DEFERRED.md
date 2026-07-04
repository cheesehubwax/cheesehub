## Why CheeseSwap only shows 100% routes

The network log confirms it: our call to
`https://wax.alcor.exchange/api/v2/swapRouter/getRoute?...&maxHops=3`
returns `"swaps": [{ "percent": 100, ... }]` — always one split. This is Alcor's **public HTTP router**, which only searches linear routes (single path, no aggregation across parallel pools).

Alcor's own frontend does **not** use that HTTP endpoint for pricing. It uses the client-side SDK **`@alcorexchange/alcor-swap-sdk`** with the `Trade` class (Uniswap-style smart order router). That router supports **`maxSplits`** and **`distributionPercent`**, which is exactly what produces the "50% / 20% / …" multi-route quotes you see on Alcor.

So the missing piece is: we call an endpoint Alcor themselves don't use for routing. To match Alcor, we need to run the same SDK client-side.

## Fix: adopt `@alcorexchange/alcor-swap-sdk` for routing

Replace the getRoute HTTP call in `fetchSwapRoute` (`src/lib/swapApi.ts`) with a client-side computation using the official Alcor SDK. The rest of the pipeline (memo → wharfkit transfer, `MultiRoutePanel`, min-received display) stays as-is because it already speaks the same `swaps[]` shape.

### Steps

1. **Add dependency** `@alcorexchange/alcor-swap-sdk` (and `eos-common` if the SDK requires it as a peer).
2. **Fetch pool state** for all active WAX pools once, cached via react-query:
   - `GET https://wax.alcor.exchange/api/v2/swap/pools` (already used in `useAlcorPools` for single pools — extend to a "list all" query with `staleTime: 30s`).
   - Map each pool row to the SDK's `Pool` constructor (`tokenA`, `tokenB`, `fee`, `sqrtPriceX64`, `tickCurrent`, `liquidity`, `tickSpacing`) using the same `parseToken` shape shown in the SDK README.
3. **New router module** `src/lib/alcorRouter.ts`:
   - Build `Token` instances for `tokenIn` / `tokenOut`.
   - Call `Trade.bestTradeExactIn(pools, currencyAmountIn, tokenOut, { maxNumResults: 1, maxHops: 3, maxSplits: 4, distributionPercent: 5 })` (same defaults Alcor uses; we can tune after visual parity).
   - Convert the `Trade` result into our existing `SwapRoute` shape:
     - `route`: concatenation of pool IDs across splits (used for display fallback).
     - `swaps[]`: one entry per split with `percent`, `route` (pool IDs), `input`, `output`, `minReceived`, `maxSent`, `memo`.
     - `output`, `minReceived`, `maxSent`, `priceImpact`, `executionPrice` from the SDK's `Trade` fields.
     - `memo`: build the multi-split memo Alcor's contract expects — `swapexactin#<pools_of_split_1>|<pools_of_split_2>|...#<receiver>#<total_min_out>@<contract>#<deadline>` (verify against Alcor's contract docs before shipping; if the contract does not accept splits in one memo, emit one `transfer` action per split, which is what Alcor's UI does).
4. **Wire into `fetchSwapRoute`**: replace the HTTP call with `computeAlcorRoute(...)`. Keep `EXACT_INPUT` / `EXACT_OUTPUT` parity by branching to `bestTradeExactOut` for exact-output.
5. **Transaction layer** (`CheeseSwapWidget` submit path): if routing returns multiple splits, push **one `transfer` action per split** in the same wharfkit transaction, each carrying its own `swapexactin#<poolIds>#…` memo. This matches Alcor's on-chain behavior and keeps min-received accurate per split.
6. **Multiroute UI**: no changes needed — `MultiRoutePanel` already iterates `route.swaps` and shows per-split percent + per-hop pool pair, so as soon as `swaps.length > 1` you'll see the same "50% / 20% / …" rows Alcor shows.

### Technical notes

- The SDK is ~pure TS and runs in the browser. Bundle cost is real but acceptable (Alcor ships it in their Nuxt UI).
- Route computation is O(pools × splits × hops). Cap `maxSplits` at 4 and gate the compute behind a small debounce (150ms) tied to `amount` input to avoid recomputing on every keystroke.
- Pool state can go stale between fetch and swap. Use `staleTime: 15–30s` and re-fetch on quote request. The min-received / slippage guard already protects users from bad execution.
- Slippage stays a user setting; apply it to each split's output before summing `minReceived`.
- Fallback: if SDK routing fails (empty pool set, throw, etc.), fall back to the current HTTP `/getRoute` call so the swap widget is never worse than today.

### Files touched

- `package.json` — add SDK.
- `src/lib/alcorRouter.ts` (new) — SDK adapter + `SwapRoute` mapping.
- `src/lib/swapApi.ts` — `fetchSwapRoute` delegates to `alcorRouter`, keeps HTTP fallback.
- `src/hooks/useAlcorPools.ts` — add `useAllAlcorPools()` for the full pool list; keep existing per-ID query for `MultiRoutePanel`.
- `src/components/swap/CheeseSwapWidget.tsx` — submit path emits one transfer per split when `route.swaps.length > 1`.
- No changes to `MultiRoutePanel.tsx`.