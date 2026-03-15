

## Why Alcor is Rate Limiting You

The problem is **multiple independent hooks all hitting the same Alcor `/tokens` endpoint** with different react-query cache keys, plus aggressive refetch intervals. Here's what's happening on every page load:

**Duplicate calls to `wax.alcor.exchange/api/v2/tokens`:**
1. `useSwapTokens` (query key: `swap-tokens`) -- fetches full token list for the selector
2. `useAlcorTokenPrices` (query key: `alcor-token-prices`) -- fetches the same endpoint for price data, with a **60-second refetchInterval**
3. `useCheesePriceData` -- hits `/tokens/cheese-cheeseburger` (separate endpoint, less of an issue)
4. `usePowerupEstimate` -- also hits `/tokens/cheese-cheeseburger`
5. TVL hooks hit `/swap/pools` and `/tickers`

So on a single page load you're already making 2+ calls to `/tokens`. The `useAlcorTokenPrices` hook refetches every 60 seconds. Opening the token selector triggers another round. Each swap route query hits `getRoute`. It adds up fast -- and Alcor likely has a ~30 req/min limit per IP.

With 10-20 users, they'd all be behind Lovable's preview domain (same origin), but in production they'd each have their own IP so it's less of an issue per-user. The real problem is **one user generating 5-10 Alcor requests per minute** from duplicate hooks.

### Plan

#### 1. Unify the `/tokens` data into a single shared query
- Make `useSwapTokens` the single source of truth for the `/tokens` endpoint data
- Have `useAlcorTokenPrices` derive its `TokenPriceMap` from the same cached query (`swap-tokens`) instead of fetching `/tokens` independently
- This eliminates one entire duplicate fetch + its 60s refetch interval

**Changes:**
- `src/hooks/useAlcorTokenPrices.ts`: Rewrite to consume the shared `swap-tokens` query data via `useQueryClient().getQueryData()` or by importing from `useSwapTokens`, building the price map from the already-fetched token list. Remove the independent fetch and refetchInterval.
- `src/hooks/useSwapTokens.ts`: Add `system_price` to the parsed token data so price info is available from the shared cache.
- `src/lib/swapApi.ts`: Add `system_price` and `usd_price` fields to the `SwapToken` type and include them in `fetchSwapTokenList`.

#### 2. Increase stale times and remove aggressive refetchInterval
- `useSwapTokens`: increase `staleTime` from 5min to 10min (token list barely changes)
- Remove the 60s `refetchInterval` from `useAlcorTokenPrices` (now derived, no independent fetching)
- `useCheesePriceData` and `usePowerupEstimate`: increase staleTime to 2-3 minutes for the individual cheese price endpoint

#### 3. Add 429 handling to `fetchSwapTokenList`
- Currently only `fetchSwapRoute` handles 429. Add the same user-friendly error for the token list fetch so it doesn't silently fail and retry immediately.

### Summary of impact
- **Before**: ~4-6 Alcor API calls on page load, plus refetches every 60s
- **After**: ~2 Alcor API calls on page load (token list + route), no periodic refetch, longer cache times
- Cuts Alcor API usage by roughly 60-70%

