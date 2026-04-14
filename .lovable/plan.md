

## Fix NFT Sort Order in Send Manager

### Problem
The "Newest" sort option is selected by default but NFTs don't appear in newest-first order.

### Root Cause
The sort comparator uses `parseInt(b.asset_id) - parseInt(a.asset_id)` (line 82). While this works for most WAX asset IDs, numeric subtraction of parsed integers can produce unstable sort results when dealing with edge cases. The `useUserNFTs` hook itself uses `Number()` instead. A more robust approach is `localeCompare` with `{ numeric: true }`, which handles arbitrarily large numeric strings without any precision concern.

### Fix
**File: `src/components/wallet/NFTSendManager.tsx`** (lines 79-84)

Replace the sort comparators:
```ts
// Before
case 'newest': result.sort((a, b) => parseInt(b.asset_id) - parseInt(a.asset_id)); break;
case 'oldest': result.sort((a, b) => parseInt(a.asset_id) - parseInt(b.asset_id)); break;

// After
case 'newest': result.sort((a, b) => b.asset_id.localeCompare(a.asset_id, undefined, { numeric: true })); break;
case 'oldest': result.sort((a, b) => a.asset_id.localeCompare(b.asset_id, undefined, { numeric: true })); break;
```

Also apply the same fix to **`src/components/dao/TreasuryNFTDeposit.tsx`** (lines 125-126) for consistency.

### Files changed: 2

