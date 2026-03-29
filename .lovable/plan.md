

## Fix "Staked in [farm]" Label Visibility + Filter Already-Staked NFTs

### Problems identified

1. **"Staked in [farm]" label invisible when image fails to load**: The retry overlay in `NFTGridCard` uses `z-20` and covers the entire card, hiding the `extraBadge` at `z-10`. If IPFS images fail (common), users never see the staked-elsewhere indicator.

2. **NFTs already staked in the current farm appearing as eligible**: The error `"asset id ... is already staked here"` means `stakedNfts` data is stale or incomplete when the eligible query runs. The eligible query filters by `stakedAssetIds`, but if that set is outdated, already-staked NFTs leak through.

### Changes

**File: `src/components/shared/NFTGridCard.tsx`**
- Raise `extraBadge` z-index from `z-10` to `z-30` so it renders above both the retry overlay (`z-20`) and the loading spinner. This ensures the "Staked in [farm]" badge and warning icon are always visible regardless of image load state.

**File: `src/components/farm/NFTStaking.tsx`**
- Add a safety filter in `filteredEligible`: exclude any NFT whose `asset_id` exists in `stakedNfts` (the current farm's staked list). This is a second line of defense against stale cache causing "already staked here" errors.
- Also filter them out in the `handleStakeAll` / stake transaction builder so even if they render, they cannot be submitted.

### Technical detail

```
NFTGridCard z-index layers:
  z-10  → selection checkmark (top-right)
  z-20  → retry/error overlay (full card)
  z-30  → extraBadge (staked-elsewhere label + warning icon) ← NEW
```

For the stale-data filter:
```ts
// In filteredEligible useMemo, add:
const currentStakedIds = new Set(stakedNfts.map(s => s.asset_id));
result = result.filter(n => !currentStakedIds.has(n.asset_id));
```

### Files changed: 2

