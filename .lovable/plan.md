

## Fix: Banner transition lag and layout shift

### Problem
When `PositionSlot` rotates between an IPFS banner and the local placeholder, it renders completely different JSX branches (`if (current.localSrc)` vs the IPFS `div`). This causes:
1. The container has no fixed height — it uses `h-auto`, so it collapses momentarily during the swap
2. The IPFS image needs to load from a gateway, causing a visible delay
3. The placeholder image also triggers a layout reflow since dimensions aren't reserved

### Fix

**`src/components/bannerads/BannerDisplay.tsx`** — Rewrite `PositionSlot` to:

1. **Fixed container**: Wrap in a `w-[580px] h-[150px]` container so the slot never collapses during transitions
2. **Render all banners simultaneously**: Instead of conditionally rendering only the current banner, render all banners in the array as absolutely positioned layers
3. **Crossfade with opacity**: The active banner gets `opacity-100`, others get `opacity-0`, with a `transition-opacity duration-500` for smooth fading
4. **Preload images**: Remove `loading="lazy"` so the next banner's image is already loaded before it fades in
5. **Keep pointer-events only on active**: `pointer-events-none` on inactive banners so clicks work correctly

This means the placeholder and the real ad are both always mounted and pre-rendered — no DOM swap, no layout shift, no loading delay during rotation.

### Files changed: 1

