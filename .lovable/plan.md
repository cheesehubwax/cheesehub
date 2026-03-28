

## Fix Alcor Farm Manager Full Refresh on Transactions

### Problem
Every transaction (claim, stake, unstake, increase liquidity) triggers `refetch()` from `useAlcorFarms`, which sets `isLoading = true` and resets all state, causing the entire manager to flash a loading spinner. Additionally, `onTransactionComplete()` triggers a second `refetchBalances()` call — but the individual handlers already call `refetchTokenBalances()` with a delay, so token balances get fetched twice.

### Root Cause
`useAlcorFarms` uses raw `useState` + manual fetch. When `refetch` (i.e. `fetchData`) is called, it immediately sets `setIsLoading(true)`, which unmounts all position cards and shows the spinner.

### Solution
1. **Background refresh in `useAlcorFarms.ts`**: Don't set `isLoading = true` on refetches — only on initial load. Add an `isRefetching` flag or simply skip `setIsLoading(true)` when data already exists.

2. **Remove double balance refetch**: In `AlcorFarmManager.tsx`, the `onSuccess` callback for `IncreaseLiquidityDialog` (line 760) already calls `refetch()` and `onTransactionComplete()`. Since `onTransactionComplete` calls `refetchBalances()`, and the individual handlers also call `refetchTokenBalances()` with a 2s delay, we get duplicates. Remove the `setTimeout(() => refetchTokenBalances(), 2000)` from individual handlers since `onTransactionComplete` already handles it.

### Changes

**`src/hooks/useAlcorFarms.ts`**
- Track whether this is the initial load vs a refetch
- Only set `isLoading = true` on initial load (when `stakedFarms` is empty and `unstakedPositions` is empty)
- Data updates silently in the background on refetch — no spinner, no unmounting

**`src/components/wallet/AlcorFarmManager.tsx`**
- Remove redundant `setTimeout(() => refetchTokenBalances(), 2000)` from `handleClaimRewards`, `handleClaimAll`, `handleUnstake`, `handleStakeToIncentive`, `handleStakeAllIncentives`, and `handleClaimUnstakeAllExpired` — the parent's `onTransactionComplete` already refetches balances

### Files changed: 2
- `src/hooks/useAlcorFarms.ts`
- `src/components/wallet/AlcorFarmManager.tsx`

