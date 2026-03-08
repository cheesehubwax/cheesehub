
# CheeseHub Complete Recreation - Implementation Plan

## Current Status Analysis

The project currently has:
- Phase 1 complete: Foundation, theme, basic routing
- Phase 2 complete: Core lib files, contexts (WaxContext, CartContext)
- Phase 3 complete: Custom hooks for blockchain data
- Phase 4 partially complete: Only home page components exist

**What's Missing:**
All dApp pages have placeholder content instead of functional UI components. The following need to be created from the original GitHub repository:

---

## Implementation Plan

### Part A: PowerUp Feature (Complete)

**Files to create:**
1. `src/components/powerup/PowerUpCard.tsx` - Main powerup form with CHEESE input, recipient, resource estimation
2. `src/components/powerup/PowerupStatsBar.tsx` - Stats display (total powerups, WAX burnt, CHEESE nulled)
3. `src/components/powerup/CheeseInput.tsx` - Token amount input with balance display
4. `src/components/powerup/RecipientInput.tsx` - Account name input with validation
5. `src/components/powerup/ResourceEstimate.tsx` - CPU/NET resource calculation display

**Files to update:**
- `src/pages/PowerUp.tsx` - Replace placeholder with full functional UI

---

### Part B: Drops Feature (Complete)

**Files to create:**
1. `src/components/drops/DropsHero.tsx` - Hero section with stats
2. `src/components/drops/DropCard.tsx` - Individual drop display with IPFS image handling
3. `src/components/drops/VirtualizedDropGrid.tsx` - Performance-optimized grid (SimpleDropGrid export)
4. `src/components/drops/DropsPagination.tsx` - Pagination controls
5. `src/components/drops/CartDrawer.tsx` - Shopping cart sidebar
6. `src/components/drops/CreateDrop.tsx` - Drop creation wizard (multi-step form)
7. `src/components/drops/MyDrops.tsx` - User's created drops list
8. `src/components/drops/TokenPriceInput.tsx` - Price input with token selection
9. `src/components/drops/PremintNFTPicker.tsx` - NFT selection for premint
10. `src/components/drops/ManageRamDialog.tsx` - RAM management modal
11. `src/components/drops/DropsHeader.tsx` - Alternate header component

**Files to update:**
- `src/pages/Drops.tsx` - Full implementation with tabs, search, filters, pagination
- `src/pages/DropDetail.tsx` - Individual drop purchase page
- `src/hooks/useEnrichDrops.ts` - Add `usePrefetchDrops`, `retryFailedDrops`, `markDropAsFailed` exports
- `src/services/atomicApi.ts` - Add `fetchCheeseDropStats` function

---

### Part C: Farm Feature (Complete)

**Files to create:**
1. `src/components/farm/BrowseFarms.tsx` - Farm listing with search/filter
2. `src/components/farm/FarmCard.tsx` - Individual farm display
3. `src/components/farm/FarmDetail.tsx` - Detailed farm view with staking
4. `src/components/farm/MyFarms.tsx` - User's farms list
5. `src/components/farm/CreateFarm.tsx` - Farm creation form (multi-step)
6. `src/components/farm/NFTStaking.tsx` - NFT staking interface
7. `src/components/farm/ManageStakableAssets.tsx` - Asset configuration
8. `src/components/farm/DepositRewardsDialog.tsx` - Reward deposit modal
9. `src/components/farm/ExtendFarmDialog.tsx` - Farm extension modal
10. `src/components/farm/OpenFarmDialog.tsx` - Farm activation modal
11. `src/components/farm/FarmFaq.tsx` - FAQ accordion

**Files to update:**
- `src/pages/Farm.tsx` - Full implementation with tabs and routing

---

### Part D: DAO Feature (Complete)

**Files to create:**
1. `src/components/dao/BrowseDaos.tsx` - DAO listing with search
2. `src/components/dao/DaoCard.tsx` - Individual DAO display
3. `src/components/dao/DaoDetail.tsx` - Detailed DAO view with proposals
4. `src/components/dao/MyDaos.tsx` - User's DAOs list
5. `src/components/dao/CreateDao.tsx` - DAO creation form (5-step wizard)
6. `src/components/dao/CreateProposal.tsx` - Proposal creation form
7. `src/components/dao/ProposalCard.tsx` - Proposal display with voting
8. `src/components/dao/DaoStaking.tsx` - Token staking for voting power
9. `src/components/dao/EditDaoProfile.tsx` - DAO settings editor
10. `src/components/dao/EditProposalCost.tsx` - Proposal cost settings
11. `src/components/dao/TreasuryDeposit.tsx` - Token treasury deposit
12. `src/components/dao/TreasuryNFTDeposit.tsx` - NFT treasury deposit
13. `src/components/dao/NFTVotePicker.tsx` - NFT selection for voting

**Files to update:**
- `src/pages/Dao.tsx` - Full implementation with tabs
- `src/App.tsx` - Add DAO detail route `/dao/:daoName`

---

### Part E: Locker Feature (Complete)

**Files to create:**
1. `src/components/locker/CreateLock.tsx` - Token lock creation form
2. `src/components/locker/MyLocks.tsx` - User's token locks list with claim/extend
3. `src/components/locker/CreateLiquidityLock.tsx` - LP lock creation form
4. `src/components/locker/MyLiquidityLocks.tsx` - User's LP locks list

**Files to update:**
- `src/pages/Locker.tsx` - Full implementation with nested tabs (Token/Liquidity)

---

### Part F: Wallet & Shared Components

**Files to create:**
1. `src/components/WalletTransferDialog.tsx` - Full wallet modal (transfer, resources, NFTs, voting, farms)
2. `src/components/wallet/WalletResources.tsx` - CPU/NET/RAM display
3. `src/components/wallet/RamManager.tsx` - Buy/sell RAM
4. `src/components/wallet/StakeManager.tsx` - Stake/unstake CPU/NET
5. `src/components/wallet/VoteManager.tsx` - Vote for block producers
6. `src/components/wallet/VoteRewardsManager.tsx` - Claim vote rewards
7. `src/components/wallet/RentResourcesManager.tsx` - PowerUp rental
8. `src/components/wallet/AlcorFarmManager.tsx` - Alcor farm staking
9. `src/components/wallet/CreateAlcorFarmDialog.tsx` - Create Alcor position
10. `src/components/wallet/IncreaseLiquidityDialog.tsx` - Add liquidity
11. `src/components/wallet/NFTSendManager.tsx` - Send NFTs
12. `src/components/wallet/TransactionSuccessDialog.tsx` - TX success modal
13. `src/components/shared/FeePaymentSelector.tsx` - Fee token selection (CHEESE 20% discount)
14. `src/components/TokenLogo.tsx` - Dynamic token logo component

---

### Part G: Music Player

**Files to create:**
1. `src/components/music/CheeseAmpPlayer.tsx` - Full music player with controls
2. `src/components/music/CheeseAmpMiniPlayer.tsx` - Floating mini player
3. `src/components/music/CheeseAmpDialog.tsx` - Player modal wrapper
4. `src/components/music/MediaDisplay.tsx` - Media visualization

---

### Part H: Swap Feature

**Files to create:**
1. `src/components/swap/CheeseSwapDialog.tsx` - Token swap interface
2. `src/components/swap/CheeseSwap.css` - Swap-specific styles

---

### Part I: Smart Contracts (Reference)

**Files to create:**
1. `contracts/cheesefeefee/cheesefeefee.cpp` - Main contract source
2. `contracts/cheesefeefee/cheesefeefee.hpp` - Header file
3. `contracts/cheesefeefee/Makefile` - Build configuration
4. `contracts/cheesefeefee/README.md` - Contract documentation

---

### Part J: Additional Updates

**Hook updates needed:**
- `src/hooks/useEnrichDrops.ts` - Add missing exports
- `src/hooks/usePowerupStats.ts` - Ensure returns correct shape

**Service updates needed:**
- `src/services/atomicApi.ts` - Add `fetchCheeseDropStats`

**Context updates:**
- `src/context/WaxContext.tsx` - Ensure all transaction methods are complete

**App routing:**
- `src/App.tsx` - Add `/dao/:daoName` route for DAO detail view

---

## Technical Notes

### File Sizes (Large Components)
Some components are very large due to complex functionality:
- `CreateDao.tsx` - ~55KB (5-step wizard)
- `NFTStaking.tsx` - ~59KB (complex NFT grid with staking)
- `DaoDetail.tsx` - ~43KB (full DAO view with proposals)
- `ProposalCard.tsx` - ~40KB (voting interface)
- `CreateFarm.tsx` - ~32KB (multi-step form)
- `CreateDrop.tsx` - ~37KB (drop wizard)
- `WalletTransferDialog.tsx` - ~28KB (multi-tab wallet)
- `CheeseAmpPlayer.tsx` - ~27KB (full audio player)

### Dependencies Used
- WAX blockchain: `@wharfkit/session`, `@wharfkit/wallet-plugin-anchor`, `@wharfkit/wallet-plugin-cloudwallet`
- State: `zustand` for music player, React Context for wallet/cart
- Virtualization: `@tanstack/react-virtual` for large drop grids
- UI: shadcn/ui components with dark cheese theme

### Implementation Order
Due to interdependencies, I recommend implementing in this order:
1. Shared components (TokenLogo, FeePaymentSelector)
2. PowerUp (simplest, standalone)
3. Locker (medium complexity)
4. DAO (complex, but referenced by other features)
5. Farm (complex, uses DAO patterns)
6. Drops (most complex, uses everything)
7. Wallet modal (integrates with all features)
8. Music player (standalone enhancement)

---

## Summary

This plan covers the complete recreation of CheeseHub with:
- **~70+ components** across 10 feature areas
- **Full blockchain integration** with WAX, NFTHive, AtomicAssets, WaxDAO
- **All dApp functionality**: PowerUp, Drops, Farm, DAO, Locker
- **Supporting features**: Wallet modal, music player, swap
- **Smart contract reference files** for the CHEESEFEEFEE contract

Each component will be copied exactly from the original repository to ensure 1:1 feature parity.
