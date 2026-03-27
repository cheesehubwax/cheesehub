

## Fix NFT Hover Card Clipping in Send NFTs Viewer

### Problem
The HoverCard is set to `side="top"` which clips above the scroll container for top-row NFTs. Side NFTs also get cut off horizontally because the popover renders inside the overflow container.

### Solution
Two changes in `src/components/wallet/NFTSendManager.tsx`:

1. **Use Radix portal** — Add `collisionBoundary` and ensure the HoverCardContent renders via portal (default behavior) so it escapes the `overflow-auto` container. The issue is the scroll container clips the popover. We need to add `avoidCollisions={true}` (default) and `collisionPadding={8}` so Radix auto-flips the side when there's not enough room.

2. **Remove fixed `side="top"`** — Remove `side="top"` or keep it as a preference but let Radix auto-flip. With collision detection, it will show below for top-row NFTs and adjust horizontally for side NFTs.

### Files changed: 1
- `src/components/wallet/NFTSendManager.tsx` — Change `HoverCardContent` props from `side="top"` to `side="top" collisionPadding={16}` and add `align="center"`. The Radix primitive auto-flips when colliding with viewport edges.

