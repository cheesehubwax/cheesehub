

## Homepage API Polling Analysis

### Current behavior

| Query | staleTime | refetchInterval | refetchOnWindowFocus | Effect |
|---|---|---|---|---|
| `swap-tokens` (Alcor `/api/v2/tokens`) | 10 min | **none** | **default (true)** | Re-fetches every time you tab back to the page |
| `cheese-stats` (WAX RPC) | 5 min | **60 seconds** | **default (true)** | Pings WAX RPC every 60 seconds continuously |
| `cheese-tvl` (Alcor pools + tickers + RPC) | 1 hour | none | **false** | Good — manual refresh only |

The two problems:
1. **`swap-tokens`** has `refetchOnWindowFocus` defaulting to `true`, so every time you alt-tab back it hits Alcor again. It also has no `refetchOnMount: false`, so navigating between pages re-fetches if stale.
2. **`cheese-stats`** has a 60-second `refetchInterval` polling WAX RPC continuously while the page is open. This is unnecessary — stats (supply, burn count) barely change.

### Fix

1. **`useSwapTokens.ts`** — Add `refetchOnWindowFocus: false`, `refetchOnMount: false`, `refetchOnReconnect: false`. Price data only updates on page reload or when the user explicitly triggers a swap.

2. **`useCheeseStats.ts`** — Remove the `refetchInterval: 60_000`. Add `refetchOnWindowFocus: false`, `refetchOnMount: false`, `refetchOnReconnect: false`. Stats will refresh on page reload only.

3. **TVL** — Already correct, no changes needed.

### Files to modify
- `src/hooks/useSwapTokens.ts` — Disable auto-refetching
- `src/hooks/useCheeseStats.ts` — Remove polling interval, disable auto-refetching

