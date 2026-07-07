## Bug

`SwapTokenInput` renders the 25/50/75/Max percent buttons whenever `balance && onAmountChange` are both truthy. In `CheeseSwapWidget` both panels receive `balance` and `onAmountChange`, so the buttons currently appear under whichever panel happens to hold the balance-bearing token. After flipping WAX↔CHEESE the WAX balance moves to the "You receive" panel and the percent buttons drag along with it.

The percent buttons are only meaningful for the input side (they set the amount you're paying), so they should be locked to the top "You pay" panel regardless of which token is selected.

## Fix

Two small changes, both frontend-only:

1. `src/components/swap/SwapTokenInput.tsx` — add optional `showPercentButtons?: boolean` prop (default `false`). Gate the percent-buttons row on `showPercentButtons && !readOnly && balance && onAmountChange`.
2. `src/components/swap/CheeseSwapWidget.tsx` — pass `showPercentButtons` only on the top `SwapTokenInput` (the "You pay" panel). The bottom panel stays as-is.

No changes to logic, routing, or execution.

## Verification

- Open `/`, CheeseSwap, WAX→CHEESE: percent buttons under the top WAX panel. ✅
- Flip to CHEESE→WAX: percent buttons stay under the top CHEESE panel (previously moved to the bottom WAX panel). ✅
- Verify percent buttons only show when the top panel has a balance and a live `onAmountChange` handler.

Approve and I'll apply the two-file change.
