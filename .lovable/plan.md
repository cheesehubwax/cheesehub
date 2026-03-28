

## Replace Terms Link with Inline Terms Dialog

### Problem
The "Terms of Use" link next to each checkbox uses `<a href="/terms" target="_blank">` which opens a new tab pointing to a GitHub Pages route that may not resolve properly. It also navigates the user away from their current workflow.

### Solution
Create a reusable `TermsDialog` component that opens a scrollable popup containing the full Terms of Use text. Replace the external link in all 9 files with a clickable text trigger that opens this dialog.

### New file: `src/components/shared/TermsDialog.tsx`
- A `Dialog` with `ScrollArea` containing the full Terms of Use content (extracted from `src/pages/Terms.tsx`)
- Triggered by a styled text button ("Terms of Use") — no page navigation
- Extract the terms content into a shared component (e.g. `TermsContent`) used by both the dialog and the `/terms` page to avoid duplication

### Shared content: `src/components/shared/TermsContent.tsx`
- Move all the sections/paragraphs from `src/pages/Terms.tsx` into a standalone `TermsContent` component
- Both `Terms.tsx` (full page) and `TermsDialog.tsx` (popup) render `<TermsContent />`

### Update `src/pages/Terms.tsx`
- Import and render `<TermsContent />` instead of inline JSX

### Update 9 component files
In each file, replace the `<a href="/terms" target="_blank" ...>Terms of Use <ExternalLink /></a>` with a `<TermsDialog />` trigger component. Remove the `ExternalLink` import if no longer used.

**Files:**
1. `src/components/locker/CreateLock.tsx`
2. `src/components/locker/CreateLiquidityLock.tsx`
3. `src/components/farm/CreateFarm.tsx`
4. `src/components/dao/CreateDao.tsx`
5. `src/components/dao/TreasuryDeposit.tsx`
6. `src/components/drip/CreateDrip.tsx`
7. `src/components/bannerads/RentSlotDialog.tsx`
8. `src/components/bannerads/BulkRentDialog.tsx`
9. `src/components/drops/CartDrawer.tsx`

### Dialog design
- Max width `sm:max-w-2xl`, max height `80vh`
- `ScrollArea` for the terms content
- Simple close button
- Trigger is inline styled text: `Terms of Use` in primary color with underline on hover

### Files changed: 12
- 2 new files (`TermsContent.tsx`, `TermsDialog.tsx`)
- 1 updated (`Terms.tsx` — uses shared content)
- 9 updated (checkbox label links replaced with dialog trigger)

