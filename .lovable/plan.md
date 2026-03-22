

## Fix: Alcor API rate limiting breaking swap functionality

### Root cause analysis

There are **6 distinct Alcor API call sources** across the app:

| # | Endpoint | Source | Frequency | Notes |
|---|----------|--------|-----------|-------|
| 1 | `/api/v2/tokens` | `useSwapTokens` → `fetchSwapTokenList` | Once (shared cache, 10min stale) | Token list. Shared by CheesePriceBar, swap widget, token prices, fee pricing. Well-cached. |
| 2 | `/api/v2/swapRouter/getRoute` | `useSwapRoute` → `fetchSwapRoute` | Every amount change (800ms debounce) | Swap routing. Necessary, unavoidable. |
| 3 | `/api/v2/swap/pools/{id}` | `useCheeseNullData` → `fetchAlcorPoolPrice` | **Every 30 seconds** | CheeseNull page pool price. Runs even when not on CheeseNull page if component is mounted. |
| 4 | `/api/v2/swap/pools` | `tvl.ts` → `fetchAlcorSwapCheeseTVL` | On CheesePriceBar load + manual refresh | TVL aggregation. |
| 5 | `/api/v2/tickers` | `tvl.ts` → Alcor spot tickers | On CheesePriceBar load + manual refresh | TVL spot market data. |
| 6 | `/api/v2/tokens` | `tokenLogos.ts` → `initializeTokenCache` | Fallback only (if shared cache not loaded yet) | Duplicate of #1 if race condition. |

**The main offenders are:**
- **#3**: CheeseNull pool price polling every 30s hits Alcor continuously, eating into rate limits
- **#4 + #5**: TVL fetches 2 separate Alcor endpoints on page load and every manual refresh
- **#6**: Potential duplicate token list fetch if logo system initializes before swap-tokens cache

When the user opens the swap, they may already be near the rate limit from #3/#4/#5, so the route call (#2) gets a 429.

### Solution

**1. CheeseNull pool price → use RPC instead of Alcor API**
- `fetchAlcorPoolPrice` fetches from Alcor's REST API, but this pool data is available on-chain via the `swap.alcor` contract's `pools` table
- Replace with an RPC table row fetch using `fetchTableRows` — eliminates the 30s polling against Alcor entirely

**2. TVL → cache aggressively, reduce Alcor calls**
- The TVL data (`/swap/pools` and `/tickers`) changes slowly. Set `staleTime` to 30 minutes minimum (currently 1 hour but it re-fetches on every manual refresh button click)
- Add a dedicated `staleTime` check before allowing manual refresh to prevent rapid re-fetching

**3. Token logos → remove fallback Alcor fetch entirely**
- The `initializeTokenCache()` fallback in `tokenLogos.ts` makes a redundant call to `/api/v2/tokens`. Since `useSwapTokens` already populates this cache via `initializeTokenCacheFromData`, remove the standalone fetch entirely and rely on the fallback map if the shared cache isn't ready yet

**4. Swap route → increase debounce and add retry backoff**
- Increase route debounce from 800ms to 1200ms to reduce call frequency during typing
- Add exponential backoff on 429 errors specifically

### Files changed
1. `src/lib/cheeseNullApi.ts` — Replace `fetchAlcorPoolPrice` with RPC table row fetch from `swap.alcor` contract
2. `src/lib/tokenLogos.ts` — Remove the standalone Alcor API fetch fallback, use only the fallback map
3. `src/hooks/useSwapRoute.ts` — Increase debounce to 1200ms, add 429-specific retry delay
4. `src/lib/tvl.ts` — (minor) No structural change needed, already well-cached

### Impact
- Eliminates ~2 Alcor API calls per minute (CheeseNull polling) — the biggest offender
- Removes 1 potential duplicate token list fetch (logo fallback)
- Reduces swap route call frequency by ~33%
- Zero impact on site usability — all data still available via RPC or shared cache

