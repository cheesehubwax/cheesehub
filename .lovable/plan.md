

## Unify All NFT Viewers to Match NFTSendManager Standard

### Problem
The NFT staking viewer in `NFTStaking.tsx` uses a cramped grid (`h-[420px]`, no HoverCards, bottom text overlays on cards) and the DAO `NFTVotePicker.tsx` uses a tiny `max-h-60` non-virtualized grid with 3-4 columns. The `PremintNFTPicker.tsx` also uses a small `h-80` grid with 3 columns. These all need to match the NFTSendManager's style per the existing memory standard.

### Reference standard (NFTSendManager)
- **6-column virtualized grid** (`grid-cols-6`)
- **`h-[560px]`** scroll container with `rounded-md border border-border`
- **Pure image tiles** — no bottom text overlays, `object-cover` fills the card
- **HoverCard metadata popups** with `side="top" collisionPadding={16} align="center"` showing Name, Asset ID, Collection, Schema, Template, Mint # with `text-cheese` labels
- **ROW_HEIGHT = 120**, card height `h-[115px]`

### Changes

**1. `src/components/farm/NFTStaking.tsx`**
- Update `VirtualGrid` component:
  - Change `h-[420px]` → `h-[560px]` with `rounded-md border border-border`
  - Change grid from `grid-cols-3 sm:grid-cols-4 md:grid-cols-6` → fixed `grid-cols-6`
  - Update `getGridCols()` to always return 6
- Update `NFTCard` component:
  - Remove bottom text overlay (`bg-background/90` div with name/asset_id)
  - Add fixed `h-[115px]` to the card button
  - Use `object-cover` instead of `object-contain`
  - Wrap each card in a `HoverCard` with metadata popup matching the standard (Name, Asset ID, Collection, Schema, Template with `text-cheese` labels)
  - Import `HoverCard, HoverCardTrigger, HoverCardContent` from UI

**2. `src/components/dao/NFTVotePicker.tsx`**
- Replace the non-virtualized `grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60` with a virtualized 6-column grid
  - Add `useVirtualizer` from `@tanstack/react-virtual`
  - Use `h-[560px]` scroll container with `rounded-md border border-border`
  - ROW_HEIGHT = 120, 6 columns
- Replace inline card rendering with pure image tiles (no bottom text `p` tag)
- Add HoverCard metadata popup on each card
- Remove the inline card `<p>` name text at the bottom

**3. `src/components/drops/PremintNFTPicker.tsx`**
- Change `ITEMS_PER_ROW` from 3 → 6
- Change `ITEM_HEIGHT` from 160 → 120
- Change scroll container from `h-80` → `h-[560px]`
- Change grid from `grid-cols-3` → `grid-cols-6`
- Update `NFTCard` sub-component:
  - Remove bottom name/mint text
  - Use fixed `h-[115px]`, `object-cover`
  - Add HoverCard metadata popup with standard styling

### Files changed: 3

