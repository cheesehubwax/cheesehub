

# CHEESEFarm 1:1 Replica Plan

## Summary
The current CHEESEFarm implementation is a simplified version missing many features from the reference repository. This plan covers rewriting/creating ~15 files to match the reference exactly.

## Current State vs Reference

| Area | Current | Reference |
|------|---------|-----------|
| **Farm Page** | Card-wrapped tabs, basic hero | URL-routed `/farm/:farmName`, icon-labeled tabs, BETA badge, simpler hero |
| **BrowseFarms** | Basic search + sort by active/staked | Active-only toggle, staked-only toggle (wallet-aware), sort dropdown (newest/staked/name), skeleton loading, `useQuery` |
| **FarmCard** | Simple card with logo/name/badge | Richer card with farm type badge, status badges (Under Construction, Perm Closed, Expired), reward pool display with formatted amounts, days remaining, View Details button with navigation |
| **FarmDetail** | In-component state loading, basic header + simple NFT grid | `useQuery`-based, full farm info panel (status, type, creator, dates, social links), reward pools with token logos, stats cards, creator management tools, cover image, external WaxDAO link |
| **CreateFarm** | Minimal form (name, contract, symbol, interval, payment) | Confirmation phrase gate with YouTube video, FAQ accordion, farm type selector, multiple reward tokens (up to 3), avatar/cover/description fields, social links collapsible, CHEESE/WAX payment with proper fee routing |
| **MyFarms** | Basic list | Create Farm button, count display, `useQuery` |
| **NFTStaking** | 24-NFT grid inline in FarmDetail | Dedicated 1500-line component with virtualized rendering, staked/unstaked tabs, search, bulk select, claim rewards with pending display, template caching |
| **Management Dialogs** | None | 8 separate dialog components for farm owners |
| **lib/farm.ts** | ~408 lines, missing many actions | ~1750 lines with all action builders + stakable config fetching + pending rewards |

## Implementation Plan

### 1. Expand `src/lib/farm.ts` (~1750 lines)
Add all missing exports from the reference:
- `fetchUserGlobalStakes` with multi-strategy staking detection
- `buildCreateFarmAction` (full version with farm type, profile, socials)
- `buildSetTemplateValuesAction`, `buildSetSchemaValuesAction`, `buildSetCollectionValuesAction`, `buildSetAttributeValuesAction`
- `buildEraseTemplateValuesAction`, `buildEraseSchemaValuesAction`, `buildEraseCollectionValuesAction`, `buildEraseAttributeValuesAction`
- `buildCloseFarmAction`, `buildPermCloseFarmAction`, `buildKickManyAction`, `buildEmptyFarmAction`
- `buildAddRewardsAction`, `buildOpenFarmAction`, `buildExtendFarmAction`
- `buildSetFarmProfileAction`
- `fetchUserStakes` (multi-strategy, 7+ fallback strategies)
- `fetchFarmStakableConfig` (reads valuesbytemp, valuesbysch, valuesbycol, valuesbyatt tables)
- `fetchPendingRewards`
- `calculateEffectiveBalance`, `getCollectionNames`
- All supporting interfaces (`FarmStakableConfig`, `StakableTemplate`, `StakableSchema`, `StakableCollection`, `StakableAttribute`, `PendingReward`, `EffectiveBalanceInfo`, `RewardValue`, `GlobalStakeInfo`, etc.)
- Update `FARM_CREATION_FEES.WAX` from "250" to "265"

### 2. Create `src/lib/templateCache.ts`
Template metadata caching system used by NFTStaking:
- In-memory cache with 15-minute TTL and 500-entry limit
- `getCachedTemplate`, `setCachedTemplate`, `batchGetOrFetch` functions
- LRU-style eviction

### 3. Add `fetchTemplatesBatch` to `src/services/atomicApi.ts`
Batch template fetching endpoint needed by templateCache.

### 4. Rewrite `src/pages/Farm.tsx`
- Use `useParams` for URL-based farm routing (already has route)
- Replace card-wrapped tabs with simpler layout
- Add BETA badge, update hero text to match reference
- Tab icons: Search (Browse), FolderOpen (My Farms), Plus (Create)
- Pass `onCreateFarm` callback to switch tabs
- FarmDetail rendered as full page when `farmName` param exists

### 5. Rewrite `src/components/farm/BrowseFarms.tsx`
- Use `useQuery` instead of manual `useEffect`
- Add "Active only" switch (default on), "Staked only" checkbox (wallet-connected only)
- Add sort dropdown: Newest, Most Staked, Name A-Z
- Skeleton loading grid
- Search also matches reward pool symbols
- Remove `onSelectFarm` prop (FarmCard navigates directly)

### 6. Rewrite `src/components/farm/FarmCard.tsx`
- Navigate to `/farm/{name}` on click via `useNavigate`
- Display farm type badge (Collections/Schemas/Templates/Attributes)
- Status badges: Under Construction, Permanently Closed, Closed, Expired, Active
- Stats row: NFT count + days remaining/expiration date
- Reward pools section with formatted amounts (K/M suffixes)
- "View Details" button

### 7. Rewrite `src/components/farm/FarmDetail.tsx` (~560 lines)
- Use `useQuery` for farm data, `useNavigate` for back button
- IPFS gateway fallback system for images
- Full header: logo, name, V2 badge, status badge, creator, copy name, edit profile button, refresh button
- Creator info box with contextual instructions per status
- Farm Information card: status, type, creator, created date, expiration with management buttons
- Social links section (Twitter, Discord, Telegram, Website, YouTube, Medium)
- Description section
- Reward pools with token logos and formatted balances
- Stats cards: NFTs Staked, Reward Tokens, Payout Interval, Days Left
- NFTStaking component integration
- Cover image display
- External WaxDAO link
- Edit Farm Profile dialog integration

### 8. Rewrite `src/components/farm/CreateFarm.tsx` (~386 lines)
- Confirmation phrase gate ("I understand how the new farms work")
- Embedded YouTube tutorial video
- FAQ accordion with 10 items including Anchor warning info
- Farm type selector (Collections/Schemas/Templates/Attributes)
- Multiple reward tokens (up to 3) with add/remove
- IPFS avatar and cover image fields
- Description textarea
- Social links collapsible (Twitter, Discord, Telegram, Website, YouTube, Medium)
- Hours between payouts (1-720 manual input)
- Payment flow: CHEESE (with discount) or WAX, using `buildCheesePaymentAction`/`buildWaxPaymentAction` + `buildWaxdaoFeeAction` + `buildCreateFarmAction`
- Uses `useWaxdaoFeePricing` and `useCheeseFeePricing` hooks

### 9. Rewrite `src/components/farm/MyFarms.tsx`
- Use `useQuery` for data fetching
- Skeleton loading
- "Create Your First Farm" CTA when empty
- Farm count display with "Create Farm" button
- `onCreateFarm` callback to switch to create tab

### 10. Create `src/components/farm/NFTStaking.tsx` (~1520 lines)
The largest and most complex component:
- Staked/Unstaked tabs with counts
- Virtualized NFT grid using `@tanstack/react-virtual`
- Search/filter by name, collection, template ID
- Bulk select/deselect with checkboxes
- Stake and unstake actions with batch processing
- Claim rewards button with pending reward display (amounts + token logos)
- Collection-filtered NFT loading based on farm's stakable config
- Template metadata caching via `batchGetOrFetch`
- "Already staked in another farm" warnings
- Progress indicators and skeleton loading

### 11. Create `src/components/farm/ManageStakableAssets.tsx` (~621 lines)
Dialog for farm creators to manage stakable NFT configurations:
- Add/edit/remove collections, schemas, templates, or attributes based on farm type
- Reward value inputs per reward pool
- Uses `fetchFarmStakableConfig` to show current config
- Confirmation dialogs for destructive actions (erase)

### 12. Create `src/components/farm/EditFarmProfile.tsx` (~159 lines)
Dialog for editing farm profile:
- Avatar/cover IPFS hash inputs
- Description textarea
- Social links collapsible section
- Uses `buildSetFarmProfileAction`

### 13. Create 6 Farm Management Dialogs
- **OpenFarmDialog.tsx** (~151 lines): Calendar date picker for expiration, reward deposit validation
- **ExtendFarmDialog.tsx** (~230 lines): Extension date picker with reward shortfall calculator
- **CloseFarmDialog.tsx** (~83 lines): AlertDialog confirmation
- **PermCloseFarmDialog.tsx** (~83 lines): AlertDialog with permanent closure warning
- **KickUsersDialog.tsx** (~92 lines): Kick N stakers input
- **EmptyFarmDialog.tsx** (~75 lines): Retrieve remaining rewards from perm-closed farm
- **DepositRewardsDialog.tsx** (~148 lines): Per-pool deposit amounts
- **WithdrawRewardsDialog.tsx** (~153 lines): Per-pool withdraw amounts

### Dependencies Check
- `@tanstack/react-virtual` - needed for NFTStaking virtualization (may need to install)
- `date-fns` - needed for OpenFarmDialog/ExtendFarmDialog date formatting (may need to install)
- All other deps (`@tanstack/react-query`, UI components) already available

### File Count Summary
- **Modified**: 6 files (Farm.tsx, BrowseFarms.tsx, FarmCard.tsx, FarmDetail.tsx, CreateFarm.tsx, MyFarms.tsx, farm.ts, atomicApi.ts)
- **Created**: 10 files (templateCache.ts, NFTStaking.tsx, ManageStakableAssets.tsx, EditFarmProfile.tsx, OpenFarmDialog.tsx, ExtendFarmDialog.tsx, CloseFarmDialog.tsx, PermCloseFarmDialog.tsx, KickUsersDialog.tsx, EmptyFarmDialog.tsx, DepositRewardsDialog.tsx, WithdrawRewardsDialog.tsx)

This is a large undertaking that will need to be done in multiple implementation steps to avoid overwhelming the build system.

