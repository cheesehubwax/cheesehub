# Select/deselect pairs in Compound All

## Goal
In the Compound All preview (after rewards are claimed), each compoundable pair gets a checkbox. All are selected by default; the user can untick any they don't want compounded. Only selected pairs are included in the compound transaction (and its 0.75% fees).

## Changes

### `src/components/wallet/CompoundAllDialog.tsx`
- New state: `selected: Set<number>` of position IDs. Reset when the dialog opens.
- When a plan is built (both `runClaimAndPlan` and `recheckBalances`), default the selection to all compoundable position IDs; on re-check, keep any still-compoundable positions the user already deselected (deselected IDs persist across re-checks).
- Each compoundable row in the preview gets a checkbox (checked = selected). Toggling updates the set.
- Header row with "Select all" / "Deselect all" affordance (a checkbox in a small header line showing "N of M selected").
- `runCompound` filters `plan.compoundable` to selected IDs before building fee + deposit actions; fee totals are computed from the filtered entries only.
- "Add to N positions" button counts only selected entries and is disabled when zero are selected.
- Skipped list, claim flow, and re-check behaviour otherwise unchanged.

### Tests — `src/test/alcorCompound.test.ts`
- Pure-logic level: filtering compoundable entries by a selected-ID set before `buildCompoundFeeTotals` yields fees only for selected entries (small helper or inline filter test).

## Technical details
- No changes to claiming, balance reading, or fee rate — only which planned deposits are executed.
- Selection lives in component state keyed by `positionId`, so a re-check that produces the same plan keeps the user's choices.
- Compound still spends only the claim delta; deselected rewards simply stay in the wallet.
