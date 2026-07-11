Yes — this error is very likely because the HTTP route is sending the selected slippage incorrectly.

For your 1000 WAX quote, the displayed minimum `536.2604 CHEESE` is only about `0.01%` below `536.3141`, not `1%` below it. The transaction then actually received about `535.7289 CHEESE`, which would be fine under 1% slippage but fails against the too-tight `536.2604` minimum.

Plan:

1. Fix the Alcor HTTP route request in `src/lib/swapApi.ts`
   - Change the `slippage` query param from dividing by 100 to sending the selected percent directly.
   - Example: selected `1%` should send `1`, not `0.01`.
   - Example: selected `0.5%` should send `0.5`, not rounded to `0.01`.

2. Keep the SDK split router behavior unchanged
   - The SDK path already treats `1` as `1%` correctly.
   - The previous per-split min widening still remains useful for split SDK routes.

3. Verify the quote after the change
   - For the same 1000 WAX to CHEESE example, `Expected Output` may still be around `536.3141`, but `Min. Received` at 1% should be around `531.0040`, not `536.2604`.
   - This should prevent the same `Received lower than minTokenOut` failure when execution is within the selected slippage.