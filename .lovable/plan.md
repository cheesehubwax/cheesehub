Add an "Expected Output" row to the swap route details in `src/components/swap/CheeseSwapWidget.tsx`, placed between the Slippage row and the Min. Received row.

The value mirrors what's displayed in the "You receive" box: `formatTokenAmount(route.output, tokenOut?.precision ?? 8)` followed by `tokenOut.ticker`. Styling matches the surrounding rows (`text-muted-foreground` label, `text-foreground` value, same `flex justify-between` layout).

No logic changes, no other files touched.