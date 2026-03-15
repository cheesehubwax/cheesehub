
## Fix CHEESEWallet zoom/dimension behavior

### Problem
The wallet dialog uses viewport-relative units (`85vh`, `calc(85vh-52px)`) for height. When the browser zoom level changes, `vh` units change relative to the visible viewport, causing the wallet to shrink/grow unpredictably. The width uses `max-w-[1050px]` which is fine, but the height needs to be fixed.

### Solution
Replace viewport-relative heights with fixed pixel dimensions so the wallet maintains consistent proportions regardless of zoom level, and add proper overflow handling:

**File: `src/components/wallet/WalletTransferDialog.tsx`**

1. Change DialogContent from `max-h-[85vh]` to a fixed height like `h-[680px]` with `max-h-[85vh]` as a fallback cap so it doesn't overflow on small screens
2. Change the inner flex container from `h-[calc(85vh-52px)]` to `flex-1 overflow-hidden` so it fills the remaining space after the header
3. This way the wallet has a consistent fixed size at 100% zoom, and gracefully constrains on smaller viewports

**Changes:**
- Line 211: `"sm:max-w-[1050px] h-[680px] max-h-[85vh] p-0 gap-0 overflow-hidden bg-card border-border flex flex-col"`
- Line 238: `<div className="flex flex-1 min-h-0">` (replace the fixed `h-[calc(85vh-52px)]`)

This ensures:
- At 100% zoom: wallet is always 1050x680px
- When zoomed in: `max-h-[85vh]` caps it so it doesn't overflow the viewport
- The `flex-1 min-h-0` pattern lets the content area fill remaining space correctly
- Sidebar and scroll area adapt naturally
