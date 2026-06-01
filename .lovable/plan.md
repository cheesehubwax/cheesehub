## Goal

When any drop sells out (remaining = 0), keep it visible in the grid as a black-and-white placeholder with a clear "SOLD" overlay, instead of looking identical to live drops. Sold-out cards should sink to the bottom of their grid so available drops stay on top.

Applies to every drops grid on the page (semi-premium account names, premium account names, official collectibles, and CHEESE drops), not just semi-premium.

## Scope

UI-only. No data layer, contract, or loader changes. The drops loader already returns drops with `remaining = 0`; we just render them differently and reorder them.

## Changes

1. **`src/components/drops/DropCard.tsx`**
   - Treat any card with `drop.remaining === 0` as the sold-out variant automatically (no new prop needed — sold-out state is intrinsic to the drop).
   - Sold-out rendering:
     - Render the card as a non-interactive `<div>` (no `<Link>`); drop hover scale / hover-glow / always-glow classes.
     - Apply `grayscale opacity-70` to the image.
     - Add a centered diagonal "SOLD" stamp overlay above the image (semantic tokens only: `bg-destructive/90 text-destructive-foreground`, `-rotate-12`, bold display font, thick border, high z-index so it sits above the gradient and existing badges).
     - Keep the existing bottom "Sold Out" footer.
   - Live drops render exactly as today; `alwaysGlow` only applies when not sold out.

2. **`src/components/drops/VirtualizedDropGrid.tsx`**
   - Inside both `VirtualizedDropGrid` and `SimpleDropGrid`, stable-reorder the incoming `drops` so `remaining > 0` items appear first (original order preserved within each group) and `remaining === 0` items appear at the end. This makes the bottom-sink behavior automatic for every consumer.

3. **`src/pages/Drops.tsx`**
   - No code changes required — sort/reorder is handled inside the grids. Existing `alwaysGlow` usage on premium account names is unaffected (only applies when not sold out).

## Out of scope

- Hiding sold drops from the API response.
- Fetching, filtering, or cart logic.
- Drop detail page (`/drops/:id`) styling.
- Pre-1-of-1 detection (we treat any 0-remaining drop the same way, regardless of supply size).
