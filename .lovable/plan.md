## Root cause

The multiroute panel loads slowly on the first quote because `useAlcorPools` fires one HTTP request per pool id (`/swap/pools/{id}`), gated by `isAlcorCoolingDown()`. Meanwhile the router that already produced the quote calls `fetchAllAlcorPools()` (`/swap/pools`) — a single bulk endpoint that returns every pool with the exact same `{id, fee, tokenA, tokenB}` shape and caches the result in memory for 20s. So the data the panel needs is already in the browser the moment the quote resolves; we're just re-fetching each pool one-by-one for no reason.

Resetting the amount "fixes" it only because by then those N per-pool requests have finally completed and populated the react-query cache.

## Fix (visual-only, no router/hook changes)

### `src/hooks/useAlcorPools.ts`
Replace the `useQueries` fan-out with a single `useQuery`:

- Query key: `["alcor-all-pools"]`.
- Query fn: `fetchAllAlcorPools(signal)` (already exported from `src/lib/alcorRouter.ts`).
- `staleTime: 20_000` (matches the in-memory cache TTL), `gcTime: 5 * 60_000`, `retry: 2`, `placeholderData: (prev) => prev`.
- Keep `enabled: !isAlcorCoolingDown()` so we don't add pressure during a 429 storm, but since `fetchAllAlcorPools` is already called by the router on every quote, its promise is typically resolved by the time the panel mounts — react-query will hydrate synchronously from the shared cache.
- Build the returned `pools` map by filtering the bulk list down to the requested ids. `RawAlcorPool` and `AlcorPool` are structurally identical for the fields the panel reads (`id`, `fee`, `tokenA/tokenB.{id,symbol,contract,decimals}`), so no shape conversion is needed beyond a light cast.
- Recompute `isReady` as `uniqueIds.length > 0 && uniqueIds.every((id) => map.has(id))`, `hasError` from the single query, `isLoading` from `query.isLoading`.

### No other files change
`MultiRoutePanel.tsx` already gates rendering on `isReady`, so once the hook returns the fully populated map on the first pass the visual paints immediately with correct symbols and fees. `alcorRouter.ts`, `useSwapRoute.ts`, and the swap widget are untouched.

## Why this is safe

- The bulk endpoint is the same one the router already hits; we're piggy-backing on a request that has to happen anyway. No extra load on Alcor.
- The router's `poolsCache` (in `alcorRouter.ts`) and react-query's cache are independent, but both hydrate from the same fetch — react-query's version just gives the UI a reactive handle on it.
- No changes to swap math, retry logic, cooldowns, or the actual on-chain trade.
