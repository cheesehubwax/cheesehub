Gate the SDK split router's `distributionPercent` on the USD size of the trade so small trades use a coarser grid (faster, still-good quote) and larger trades keep the fine 1% grid.

## Rule

```
inputUsd = |amount| * (usd price of the token being spent)
distributionPercent = inputUsd < 30 ? 5 : 1
```

- For `EXACT_INPUT`, "the token being spent" is `tokenIn`.
- For `EXACT_OUTPUT`, we don't know the input amount yet, so use `tokenOut.usd_price * amount` (output-value-based) — same $30 USD boundary applied to the trade's economic size.
- If the relevant USD price is missing/0, fall back to `1` (current, safest behavior).

## Where the switch lives

The knob is already threaded end-to-end. It just needs to be computed once and passed in.

- `src/hooks/useSwapRoute.ts` — compute `distributionPercent` from the amount and token prices, pass it to `computeAlcorTrade`.
- `src/lib/alcorRouter.ts` — `computeAlcorTrade` already accepts `distributionPercent` and forwards it into the percent grid; no signature change needed.
- No change to `swapApi.ts` (HTTP endpoint has its own grid we don't control).

## Logging

Include the chosen `distributionPercent` and computed `inputUsd` in the existing SDK quote log line so we can verify in the console which grid was applied to a given trade. This piggybacks on the observability line already produced by `computeAlcorTrade`.

## Non-goals

- No change to `maxHops`, pool cap, or `minSplits`/`maxSplits`.
- No graduated tiers beyond the binary $30 boundary.
- No change to the HTTP fallback path.

## Validation

After the change:
1. Quote a ~$5 WAX→CHEESE swap → console should show `distributionPercent=5`.
2. Quote a ~$100 WAX→CHEESE swap → console should show `distributionPercent=1`.
3. Quote a token with no `usd_price` → console should show `distributionPercent=1`.

Behavior parity check: the small-trade case should still return a valid multi-split quote and remain competitive with the HTTP router; if not, we revisit the threshold.
