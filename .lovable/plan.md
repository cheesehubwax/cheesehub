# Fix invisible Compound All button

## Problem

The Compound All button in the Alcor farm manager only renders when at least one staked position has farms paying out **both** tokens of its own pool (`compoundableCount > 0`). When no position qualifies, the button disappears entirely — so the user can't see it or learn why.

## Fix

1. **Always show the button** next to Claim All whenever there are staked farm positions, regardless of `compoundableCount`.
2. **Qualifying positions pre-checked**: positions whose farms pay both pool tokens are included in the compound plan.
3. **Open the dialog even when 0 qualify**: the existing dialog already lists skipped positions with reasons ("rewards only cover one pool token", etc.), so opening it with zero compoundable positions shows an explanation instead of hiding the button.
4. Keep the count badge (`Compound All (N)`) showing how many positions will actually compound.

## Technical details

- `src/components/wallet/AlcorFarmManager.tsx`: change the render condition at ~line 513 from `compoundableCount > 0` to `compoundPositions.length > 0` (button shows whenever positions with incentives exist). The dialog (`CompoundAllDialog.tsx`) already handles empty/skip lists, so no dialog changes needed.
- Verify: typecheck + focused vitest + preview build log.
