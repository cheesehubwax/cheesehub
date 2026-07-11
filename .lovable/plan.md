## Goal
After a swap transaction succeeds, both the "You pay" and "You receive" balances in the CHEESESwap widget must update immediately, not after a 1.5s delay.

## Current behavior
In `src/components/swap/CheeseSwapWidget.tsx` `handleSwap()` waits 1500ms then invalidates `["all-token-balances"]`. Because Hyperion (the primary balance source in `useAllTokenBalances`) typically lags a few seconds behind chain state, a single delayed refetch often still returns pre-swap balances, and the user sees stale numbers.

Also, `useSwapTokenBalance` prefers the shared cache value over its RPC fallback, so simply refetching the fallback query won't move the displayed number unless the shared cache is updated too.

## Fix — `src/components/swap/CheeseSwapWidget.tsx` only

Replace the single delayed invalidation in `handleSwap()`'s success branch with an immediate + resilient refresh sequence that reads authoritative on-chain state via RPC (which reflects the new balances the instant the tx is included) and writes it into the shared `all-token-balances` cache so both `SwapTokenInput` panels re-render right away:

1. Immediately after `session.transact(...)` resolves:
   - Fire two direct RPC balance reads in parallel using the existing `fetchSingleTokenBalance` helper from `src/lib/waxRpcFallback.ts`, one for `tokenIn` and one for `tokenOut`.
   - When each resolves, use `queryClient.setQueryData(["all-token-balances", accountName], ...)` to patch the matching `{contract, symbol}` entry inside `data.tokens` with the fresh amount (add the token entry if it wasn't previously in the list, e.g. first-time receive). Keep all other tokens untouched.
   - This makes the two displayed balances update within one render, using authoritative RPC data.

2. In parallel, call `queryClient.invalidateQueries({ queryKey: ["all-token-balances", accountName] })` right away so Hyperion is refetched for the full token list.

3. Schedule one more `invalidateQueries` at ~4000ms to reconcile with Hyperion once its indexer catches up (guards against the RPC patch drifting from Hyperion's eventual value).

4. Remove the old `setTimeout(..., 1500)` block.

No changes to `useSwapTokenBalance`, `useAllTokenBalances`, the SDK, route logic, or any other component. Purely a post-transaction refresh improvement scoped to the swap widget.

## Technical notes
- `fetchSingleTokenBalance(account, contract, symbol)` already exists and is used by `useSwapTokenBalance`'s fallback path — reusing it keeps behavior consistent.
- `setQueryData` on `["all-token-balances", accountName]` is safe: the shape is `{ tokens: TokenWithBalance[], usedFallback: boolean }`; we preserve `usedFallback` and only mutate the two token rows.
- RPC failures for one/both tokens are non-fatal — we still fall back to the invalidation path, matching current behavior.
