

## Consolidate Alcor API Calls to Eliminate Rate Limiting

### Problem

The app makes **5+ separate Alcor API requests** on page load, exhausting the rate limit before you even open the swap widget:

| # | Endpoint | Source | When |
|---|---|---|---|
| 1 | `/api/v2/tokens` | `tokenLogos.ts` → `ensureTokenCacheLoaded()` | App init (main.tsx) |
| 2 | `/api/v2/tokens` | `useSwapTokens` → `fetchSwapTokenList()` | Any component using tokens |
| 3 | `/api/v2/tokens/cheese-cheeseburger` | `useCheesePriceData` | Homepage |
| 4 | `/api/v2/tokens/cheese-cheeseburger` | `usePowerupEstimate` → `fetchCheesePrice()` | PowerUp page |
| 5 | `/api/v2/swap/pools` | `tvl.ts` | Homepage (TVL) |
| 6 | `/api/v2/tickers` | `tvl.ts` | Homepage (TVL) |
| 7 | `/api/v2/swap/pools` | `cheeseNullApi.ts` | CheeseNull page |

The cheesehub repo has the same issue — it was never consolidated there either. Calls #1 and #2 are identical, and #3/#4 are subsets of #1/#2.

### Fix

**A. Eliminate duplicate `/api/v2/tokens` fetches (calls 1, 2, 3, 4)**

1. **`src/lib/tokenLogos.ts`** — Add `initializeTokenCacheFromData(tokens: Array<{symbol: string, contract: string}>)` that populates the cache from pre-fetched data. Keep `ensureTokenCacheLoaded()` as a fallback but make it a no-op if cache is already populated.

2. **`src/main.tsx`** — Remove the `ensureTokenCacheLoaded()` call (it will be initialized from the shared query instead).

3. **`src/hooks/useSwapTokens.ts`** — After the `swap-tokens` query resolves, call `initializeTokenCacheFromData()` to populate the logo cache. This makes the single `/api/v2/tokens` fetch serve both token list and logo resolution.

4. **`src/hooks/useCheesePriceData.ts`** — Instead of fetching `/api/v2/tokens/cheese-cheeseburger` separately, derive CHEESE price from the shared `swap-tokens` query. The full token list already contains `system_price` and `usd_price` for every token including CHEESE.

5. **`src/hooks/usePowerupEstimate.ts`** — Replace the standalone `fetchCheesePrice()` function with a parameter that accepts cheese price data, passed in from the component using `useCheesePriceData` (which now derives from the shared query).

**B. Keep unique endpoints as-is (calls 5, 6, 7)**

- `/api/v2/swap/pools` (TVL and CheeseNull) — these are different endpoints from `/tokens` and are only fetched on specific pages. TVL already has 1hr staleTime and manual refresh. No change needed.
- `/api/v2/tickers` — same, only on homepage TVL. No change needed.

### Result

Page load Alcor API calls reduced from **5+** down to **1** (the shared `/api/v2/tokens`). The swap widget, TVL, and other features all derive from this single cached response.

### Files to modify

| File | Change |
|---|---|
| `src/lib/tokenLogos.ts` | Add `initializeTokenCacheFromData()`, keep fallback |
| `src/main.tsx` | Remove `ensureTokenCacheLoaded()` call |
| `src/hooks/useSwapTokens.ts` | Call `initializeTokenCacheFromData()` after query resolves |
| `src/hooks/useCheesePriceData.ts` | Derive from `swap-tokens` query instead of separate fetch |
| `src/hooks/usePowerupEstimate.ts` | Accept cheese price as parameter instead of fetching independently |
| `src/pages/PowerUp.tsx` | Pass cheese price data into the powerup estimate hook |

