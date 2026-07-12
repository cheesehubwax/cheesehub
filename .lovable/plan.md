Add WAX branding around the CHEESEHub header using the uploaded WAX logo.

1. Process the uploaded WAX logo (`user-uploads://image-35.png`) to remove its black background and store it as a transparent Lovable asset for use in the header.

2. Refactor `src/components/Header.tsx` into a two-column header layout:
   - Left brand column spans both header rows and stacks vertically:
     - Existing CHEESEHub logo + title (top row)
     - "only on" microcopy in small white/foreground text directly beneath the title
     - WAX logo beneath the microcopy, aligned with the secondary nav row
   - Right nav column:
     - Top row keeps the primary nav links + wallet/cart actions
     - Bottom row keeps the secondary nav links (CHEESELock, CHEESEDrop) and aligns horizontally with the WAX logo

3. Keep mobile behavior unchanged: the hamburger sheet and single-row brand layout remain as-is; the WAX branding can be hidden or collapsed gracefully on small screens.

4. Verify the header layout in the preview and confirm the WAX logo renders cleanly without a black rectangle.