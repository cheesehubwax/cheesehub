# Bulk Edit from the Multi-Select Bar

## Goal
When multiple slots are checkmarked on CHEESEAds, one floating bar appears with three actions: **Clear**, **Edit**, **Rent All**. Edit opens the same banner-edit form used for a single ad, and applies the image + link to every checked slot you own in one transaction.

## Current state (verified in code)
- `SlotCalendar.tsx` keeps two separate selections (`selectedSlots` for renting, `selectedEditSlots` for editing) and a `selectionMode` of `"rent" | "edit" | null`. Picking a slot in one mode wipes the other selection.
- Each slot row renders only one checkbox: a rent checkbox when the slot is rentable, otherwise an edit checkbox when you own it.
- Two separate floating bars exist: rent bar (Clear + Rent All) and edit bar (Clear + Edit All).
- `BulkEditBannerDialog.tsx` already exists and batches `editadbanner` / `editsharedad` actions for every selected slot — it just lives behind the second, separate bar.

## What changes
1. **One floating bar, three buttons.** Replace the two bars with a single bar showing the total number of selected slots and:
   - `Clear` — clears everything (unchanged behaviour).
   - `Edit` — opens `BulkEditBannerDialog` with the selected slots you own. Only pressable when at least one checked slot is a slot you have already rented; otherwise it renders disabled (greyed out), so it can never act on slots you don't own.
   - `Rent All` — opens `BulkRentDialog` with the selected rentable slots. Shown only when at least one rentable slot is selected.
   When only one kind is selected, only that action button shows, so today's behaviour is preserved.
2. **Allow mixed selection.** Stop clearing the other list when switching kinds: a slot can be checked for renting while another is checked for editing, and each button acts on its own subset.
3. **Show both checkboxes where applicable.** If a slot is both rentable and editable (e.g. a shared slot you already hold one side of), render the rent checkbox and the edit checkbox is still reachable — priority stays rent-first so nothing regresses.
4. Copy tweaks: button label becomes `Edit` (was `Edit All`), and the bar icon reflects a mixed selection.

## Behaviour details
- Bulk edit continues to require an IPFS hash, blocks blocklisted domains, and shows the 580 × 150 px reminder and preview — identical to the single-ad edit dialog.
- Slots inside the edit-cutoff window or suspended slots stay unselectable for editing, as today.
- On success the selection clears and the calendar refetches.

## Technical notes
- Only `src/components/bannerads/SlotCalendar.tsx` needs edits: drop `selectionMode`, keep the two arrays as independent lists, derive `totalSelected = selectedSlots.length + selectedEditSlots.length`, and render one bar with conditional buttons.
- `BulkEditBannerDialog` and `BulkRentDialog` are reused unchanged.
