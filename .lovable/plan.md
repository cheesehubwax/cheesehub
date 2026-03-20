

## Consolidate Swap Balance Fetching

### Problem
The Alcor Swap widget makes redundant balance API calls that duplicate what the wallet already fetches:

- **`useSwapTokenBalance`** (used in `CheeseSwapWidget`): fires 2 individual `get_currency_balance` RPC calls (one for tokenIn, one for tokenOut) on its own query keys
- **`useSwapTokenBalances`** (used in `TokenSelector`): fires a full Hyperion `get_tokens` call + RPC fallback for popular tokens — duplicating the same Hyperion call `useAllTokenBalances` already makes
- **`useAllTokenBalances`** (wallet): already fetches all balances via Hyperion with RPC fallback

Result: opening the swap fires dozens of redundant RPC calls, triggering Alcor/RPC rate limits.

### Fix

**Reuse the shared `all-token-balances` query for everything:**

1. **`useSwapTokenBalance.ts`** — rewrite to read from the `all-token-balances` react-query cache instead of making its own RPC call. Look up the token by `contract:symbol` in the cached `TokenWithBalance[]` array. If no cache hit, fall back to a single RPC call (keeps working before wallet opens).

2. **`useSwapTokenBalances.ts`** — rewrite to read from the `all-token-balances` cache. Map each swap token's `ticker_contract` key from the cached balances. Eliminates the separate Hyperion call in the token selector.

3. **`CheeseSwapWidget.tsx`** — after a successful swap, invalidate `all-token-balances` (in addition to existing invalidations). This ensures both the wallet and swap show fresh data post-transaction.

4. **`CheeseSwapDialog.tsx`** (or wherever the swap dialog opens) — trigger `all-token-balances` refetch when the swap UI opens, same pattern as the wallet dialog.

### Files to modify
- `src/hooks/useSwapTokenBalance.ts` — read from shared cache
- `src/hooks/useSwapTokenBalances.ts` — read from shared cache
- `src/components/swap/CheeseSwapWidget.tsx` — invalidate `all-token-balances` post-swap
- `src/components/swap/CheeseSwapDialog.tsx` — refetch balances on open

