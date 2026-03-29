

## Bulk Edit Banner Slots via Checkboxes

### Summary
Allow users to select multiple of their own rented slots using the existing checkbox system and apply the same IPFS hash + website URL to all of them in a single transaction.

### How it works

Currently, checkboxes only appear on **available** (rentable) slots. The change adds checkboxes to **editable** slots too (slots the user owns, not suspended, within the 48h buffer). The system tracks two selection modes: "rent" and "edit". When editable slots are selected, the floating action bar shows "Edit All" instead of "Rent All".

Mixed selections (rent + edit) are not allowed — selecting an editable slot clears any rent selections and vice versa.

### Changes

**1. `SlotCalendar.tsx`** — Main calendar component
- Add a `selectionMode` state: `"rent" | "edit" | null`
- Extend `isSlotSelectable` to also return `isEditable: true` for owned, non-suspended, in-buffer slots
- Show checkboxes on editable slots (same styling)
- When toggling selection, enforce single-mode: if switching from rent to edit or vice versa, clear previous selections
- In the floating action bar: show "Edit All" button when mode is "edit", "Rent All" when mode is "rent"
- Add `bulkEditDialogOpen` state and render `BulkEditBannerDialog`

**2. New file: `BulkEditBannerDialog.tsx`** — Bulk edit dialog
- Accepts array of selected `BannerSlot` objects
- Single IPFS hash input + single website URL input (applied to all)
- Shows list of selected slots (date + position) with remove buttons
- Preview image from IPFS hash
- On submit: builds an array of `editadbanner` / `editsharedad` actions (one per slot) and sends them in a single `session.transact` call
- Includes domain blocklist check and dimension reminder

**3. `SlotCalendar.tsx` hint text update**
- Update the checkbox hint text to mention both renting and editing

### Files changed: 2 (1 new, 1 modified)

