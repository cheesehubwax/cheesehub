

# Plan: Replicate CHEESEWallet from GitHub Repository

## Summary of Differences

The current project's wallet is a simplified version. The GitHub repo (`bewbzz/cheesehub`) has significantly more sophisticated components across nearly every file. Here are the major gaps:

## 1. Core Infrastructure Changes Required

### WaxContext (`src/context/WaxContext.tsx`)
The GitHub version includes multi-account support (`allSessions`, `switchAccount`, `addAccount`, `removeAccount`, `refreshSessions`) and `burnNFTs`. Current project lacks all of these. Must be updated to match.

### `useAllTokenBalances` hook
GitHub version uses Hyperion-first approach with RPC fallback, returns `TokenWithBalance` objects (with `balance`, `isLpToken`, `precision`), exposes `isUsingFallback` and `tokens` (not `balances`). Current version is a simple RPC-only fetch returning `TokenBalance` with different property names (`amount` vs `balance`).

### `useAlcorTokenPrices` hook
GitHub version uses `@tanstack/react-query`, returns a `TokenPriceMap` (Map of `contract:symbol` -> price in WAX). Current version is a manual `useState`/`useEffect` approach with completely different return types.

### `useAlcorFarms` hook
GitHub version is a completely different implementation using `@tanstack/react-query` with `AlcorFarmPosition`, `UnstakedIncentivesMap`, `UnstakedLPPosition`. Current version is a basic API fetch.

### `useUserNFTs` hook
GitHub version has `collection` (not `collectionName`), `isLoading` (not `loading`), `loadingProgress`, `collections`, and `burnNFTs` support. Current version uses different property names.

### `src/lib/alcorFarms.ts` -- MISSING ENTIRELY
This is a ~1126-line library for interacting with Alcor Exchange. Needed by AlcorFarmManager.

## 2. Wallet Component Rewrites

### `WalletTransferDialog.tsx` (673 lines in GitHub vs ~230 current)
GitHub version has the Send Tokens UI **inline** (not in a separate TokenSendManager). It includes:
- Token search with searchable dropdown
- Portfolio value calculation (WAX + USD)
- Token balances list with clickable waxblock links
- Inline send form with Max button
- `resourcesKey` for force-refresh
- `closeWharfkitModals` on dialog close
- `onInteractOutside` and `onEscapeKeyDown` prevented

### `AlcorFarmManager.tsx` (1282 lines in GitHub)
Massively more complex than current. Includes grouped farm positions, staking/unstaking, claiming rewards, USD value display, `CreateAlcorFarmDialog`, `IncreaseLiquidityDialog`.

### Missing files:
- `CreateAlcorFarmDialog.tsx` (515 lines) -- dialog to create new farm incentives
- `IncreaseLiquidityDialog.tsx` (352 lines) -- dialog to add liquidity to existing positions

### `NFTSendManager.tsx` (659 lines in GitHub)
GitHub version uses `collection` (not `collectionName`), has `burnNFTs` support, `loadingProgress` bar, `isLoading` property, confirmation dialogs for burn, and a completely different interface mapping.

### `RentResourcesManager.tsx` (415 lines in GitHub)
Uses `usePowerupEstimate` hook, WAX/CHEESE dual payment mode, real-time cost estimates.

### `VoteRewardsManager.tsx` (447 lines in GitHub)
More complete with live `unpaid_voteshare` calculation and claim logic.

### `StakeManager.tsx` (579 lines in GitHub)
Has refund tracking, countdown timer, full delegate/undelegate/refund tabs.

### `VoteManager.tsx` (488 lines in GitHub)
BP voting with search, proxy delegation, vote weight display.

### `WalletConnect.tsx` (290 lines in GitHub)
Multi-account switching, CHEESEAmp integration, wallet icon, different dropdown menu structure.

## 3. Implementation Plan

Due to the massive scope, this should be done in phases:

### Phase 1: Core hooks and libs
1. **Rewrite `useAlcorTokenPrices`** to match GitHub (react-query based, returns `TokenPriceMap`)
2. **Rewrite `useAllTokenBalances`** to match GitHub API (Hyperion-first, `TokenWithBalance`, `isUsingFallback`)
3. **Rewrite `useUserNFTs`** to match GitHub (property names, `loadingProgress`, `collections`, etc.)
4. **Rewrite `useAlcorFarms`** to match GitHub (react-query, staked/unstaked positions)
5. **Create `src/lib/alcorFarms.ts`** -- the full Alcor farms library
6. **Update `WaxContext`** to add `burnNFTs`, multi-account support (`allSessions`, `switchAccount`, `addAccount`, `removeAccount`)

### Phase 2: Wallet components (exact replicas from GitHub)
7. **Replace `WalletTransferDialog.tsx`** with GitHub version (inline send, portfolio value, searchable tokens)
8. **Replace `AlcorFarmManager.tsx`** with GitHub version
9. **Create `CreateAlcorFarmDialog.tsx`** and `IncreaseLiquidityDialog.tsx`**
10. **Replace `NFTSendManager.tsx`** with GitHub version
11. **Replace `RentResourcesManager.tsx`** with GitHub version
12. **Replace `VoteRewardsManager.tsx`**, `StakeManager.tsx`, `VoteManager.tsx` with GitHub versions
13. **Replace `WalletResources.tsx`**, `CreateAccountManager.tsx`, `KeyPairGenerator.tsx`, `TransactionSuccessDialog.tsx` with GitHub versions
14. **Delete `TokenSendManager.tsx`** (send tokens is inline in the GitHub WalletTransferDialog)

### Phase 3: WalletConnect
15. **Replace `WalletConnect.tsx`** with GitHub version (multi-account, CHEESEAmp -- noting CHEESEAmp may need stubs)

## Technical Notes
- The GitHub `useAllTokenBalances` imports `fetchAllTokenBalances` and `fetchAllTokenBalancesViaRpc` from `waxRpcFallback` -- we need to verify those exist in our `waxRpcFallback.ts` or add them
- The GitHub `AlcorFarmManager` imports from `@/lib/alcorFarms` which doesn't exist yet -- must create
- Multi-account in WaxContext requires `SerializedSession` from `@wharfkit/session`
- Some GitHub files reference `@/lib/cheeseAmpRoyalties`, `@/lib/musicPlayer`, `@/stores/cheeseAmpStore` -- these may or may not exist; WalletConnect references can be stubbed if missing

This is a large-scale rewrite touching ~20 files. Every wallet component will be replaced with the exact GitHub source code.

