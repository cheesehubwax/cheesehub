## Change

When the user swaps tokens via the TokenSelector, reset both amount fields so no route lookup fires until a fresh amount is entered.

## File

`src/components/swap/CheeseSwapWidget.tsx` — the `handleTokenSelect` callback (around line 158).

Currently:
```ts
if (selectorSide === "in") setTokenIn(token);
else if (selectorSide === "out") setTokenOut(token);
```

Update to also clear `amountIn` and `amountOut` (and reset `activeField` back to `"in"`) whenever the selected token actually changes:

```ts
const prev = selectorSide === "in" ? tokenIn : tokenOut;
const changed =
  !prev || prev.contract !== token.contract || prev.ticker !== token.ticker;

if (selectorSide === "in") setTokenIn(token);
else if (selectorSide === "out") setTokenOut(token);

if (changed) {
  setAmountIn("");
  setAmountOut("");
  setActiveField("in");
}
```

## Why this works

`useSwapRoute` is gated by `!!debouncedAmount && parseFloat(debouncedAmount) > 0`. Clearing both amounts disables the query immediately — no `/swapRouter/getRoute` call, no SDK fallback, no `/ticks` fan-out until the user types a new number.

## Not changing

- Flip (swap arrow) already clears both amounts — leave as-is.
- Default token initialization on mount — leave as-is.
- Debounce, retry, cooldown logic — untouched.
