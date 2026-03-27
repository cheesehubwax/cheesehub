

## Add Refresh Button to NFT Send Manager

### What
Add a refresh button (using the existing `RefreshCw` icon already imported) to the NFT viewer toolbar that calls the existing `refetch()` from `useUserNFTs`, preserving current collection and schema filter state.

### Changes

**`src/components/wallet/NFTSendManager.tsx`**
- Destructure `refetch` from `useUserNFTs` (line 30)
- Add a refresh `Button` with `RefreshCw` icon next to the sort dropdown (after line 152), calling `refetch()` on click
- Show a spinning animation on the icon while `isLoading` is true after clicking refresh
- Collection filter, schema filter, search, and sort state are all preserved (they're independent state variables)

### Files changed: 1
- `src/components/wallet/NFTSendManager.tsx`

