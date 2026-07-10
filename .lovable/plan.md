## What's causing it

Two hooks subscribe to the shared `["all-token-balances", accountName]` cache without providing a `queryFn`:

- `src/hooks/useSwapTokenBalances.ts`
- `src/hooks/useSwapTokenBalance.ts`

Both intentionally set `enabled: false` — they only want to read/select from whatever `useAllTokenBalances` already put in cache. But TanStack Query v5 still warns on mount ("No queryFn was passed…") even when the observer is disabled, because it can't guarantee a future re-enable won't try to fetch.

Functionally harmless (nothing actually refetches, balances still work), but it's noise in the console.

## Fix

Give both hooks a placeholder `queryFn` that would never realistically run, since `enabled: false` prevents execution. Using `skipToken` from `@tanstack/react-query` is the idiomatic v5 way to say "this observer never fetches" — it silences the warning without changing behavior.

### Changes

**`src/hooks/useSwapTokenBalances.ts`**
- Import `skipToken` from `@tanstack/react-query`.
- Replace `enabled: false` with `queryFn: skipToken` (drop the `enabled` line — `skipToken` disables fetching by itself).

**`src/hooks/useSwapTokenBalance.ts`**
- Same treatment on the cached-balance `useQuery` (the RPC-fallback `useQuery` below it already has a real `queryFn` and is fine).
- Keep the `enabled` guard on the fallback query as-is (it depends on `cachedBalance === undefined`).

No changes to `useAllTokenBalances`, no changes to any component, no behavioral change to balance loading.

### Validation

- Open the app / token selector — the "No queryFn was passed" warning for `["all-token-balances", …]` disappears.
- Balances still display correctly for connected accounts (WAX, CHEESE rows in swap selector still show amounts).
- Swap single-balance display (input token available balance) still populates from the shared cache, and still falls back to RPC when the cache is empty.