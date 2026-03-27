

## Add NFT Info Hover Popup in Send NFTs

### What
When hovering over an NFT card in the CHEESEWallet Send NFTs grid, a popup appears showing all available NFT details.

### Available data per NFT
- `asset_id` — unique asset ID
- `name` — NFT name
- `collection` — collection name
- `schema` — schema name
- `template_id` — template ID
- `mint` — mint number
- `image` — already visible

### Changes

**`src/components/wallet/NFTSendManager.tsx`**
- Import `HoverCard`, `HoverCardTrigger`, `HoverCardContent` from `@/components/ui/hover-card`
- Wrap each NFT `<button>` in an `HoverCard` with `openDelay={300}` to avoid flicker
- The `HoverCardTrigger` wraps the existing button (using `asChild`)
- The `HoverCardContent` shows a compact info card:
  - NFT name (bold)
  - Asset ID
  - Collection
  - Schema
  - Template ID
  - Mint #
- Style with existing text utilities, side="top" to avoid clipping at bottom of grid

### Files changed: 1
- `src/components/wallet/NFTSendManager.tsx`

