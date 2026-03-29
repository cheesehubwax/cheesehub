

## Unify All NFT Viewers: Treasury NFT Deposit + Schema Filter + Consistent Window Size

### Summary
Three changes across all NFT viewers:
1. **TreasuryNFTDeposit** needs full upgrade to use `NFTGridCard`, virtualization, IPFS fallback, and `h-[560px]` 6-column grid
2. **Schema filter** (from CHEESEWallet) needs adding to all viewers that have collection filters but lack schema filtering
3. All view windows confirmed at `h-[560px]` with 6 columns

### Current State
| Viewer | NFTGridCard | Virtualized | h-[560px] | Schema Filter | Collection Filter |
|--------|------------|-------------|-----------|---------------|-------------------|
| NFTSendManager (wallet) | Yes | Yes | Yes | Yes | Yes |
| NFTStaking (farm) | Yes | Yes | Yes | No | No |
| NFTVotePicker (dao) | Yes | Yes | Yes | No | No |
| PremintNFTPicker (drops) | Yes | Yes | Yes | No | No (collection pre-set) |
| TreasuryNFTDeposit (dao) | **No - old cards** | **No** | **No (h-[240px])** | No | Yes |

### Changes

**1. `src/components/dao/TreasuryNFTDeposit.tsx`** (major rewrite)
- Remove the old inline `NFTCard` component entirely
- Import and use `NFTGridCard` from shared component
- Import `useVirtualizer`, `useSquareGridRowHeight`
- Add schema data to NFT fetching (already available from API response)
- Change grid from non-virtualized `grid-cols-4` with `h-[240px]` to virtualized `grid-cols-6` with `h-[560px]`
- Add schema filter dropdown (appears when a collection is selected, same as wallet)
- Include schema in search filtering

**2. `src/components/farm/NFTStaking.tsx`**
- Add collection and schema filter dropdowns to the search bar area
- Derive collections and schemas from `eligibleNfts` and `stakedNftDetails`
- Apply collection/schema filters in `filteredEligible` and `filteredStaked` useMemo blocks
- Reset schema filter when collection changes

**3. `src/components/dao/NFTVotePicker.tsx`**
- Add search input, collection filter, and schema filter dropdowns
- Derive collections/schemas from `eligibleNFTs`
- Filter NFTs by search query, collection, and schema before rendering

**4. `src/components/drops/PremintNFTPicker.tsx`**
- Add schema filter dropdown (collection is pre-set, so derive schemas from loaded NFTs)
- Apply schema filter in the `filteredNFTs` useMemo

### Technical Details
- Schema filter pattern (from wallet): appears only when a collection is selected, shows `All Schemas` default plus schema names with counts
- Collection filter resets schema to `'all'` when changed
- All viewers use the same filter bar layout: `[Search] [Collection] [Schema?] [Sort] [Refresh]`
- TreasuryNFTDeposit NFT fetch updated to include `schema` and `template_id` fields from the AtomicAssets API response

### Files changed: 4

