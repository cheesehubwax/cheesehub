# CHEESEAir: warn before a RAM drop drains the WAX pool

## The problem

A RAM airdrop makes CHEESERam buy RAM with the WAX it holds. If the whole drop is worth more WAX than the pool can spend, the run starts and then fails partway. CHEESEAir currently never checks this, so the first sign of trouble is a failed transaction.

## What changes

1. CHEESEAir reads how much WAX the CHEESERam pool holds and how much of it is spendable (the pool must keep its protected reserve untouched, plus a small safety margin).
2. It converts the whole drop's CHEESE spend into the WAX the pool would have to spend.
3. If the drop exceeds the spendable WAX, a warning appears in the Distribution box next to the amount field and in the Summary:

   > This RAM airdrop needs about X WAX but the CHEESERam pool can currently spend about Y WAX. **Use the largest amount the pool can cover** (clickable figure)

   Clicking the figure fills the amount field with the largest drop the pool can handle right now, in whichever unit is selected (CHEESE or KB). In "Fixed each" mode it fills the per-holder amount that keeps the whole drop inside the limit.
4. Start Airdrop is blocked while the drop is over the limit, the same way it is already blocked for other unrunnable states. Non-RAM drops are untouched.
5. The pool figure refreshes on its own so the number stays current, and the warning disappears once the amount is inside the limit.

## Technical detail

- New chain read in `src/lib/airdropChain.ts`: extend the `getResourcePricing` batch with `ram.chz`'s liquid WAX balance (`get_currency_balance` on `eosio.token`) and surface `min_liquid_reserve` and `reserve_buffer_bps`, which are already in the config row being fetched. Add to `RamPricing` in `src/lib/airdropResources.ts`: `liquidWax`, `minLiquidReserve`, `reserveBufferBps`.
- New pure helpers in `src/lib/airdropResources.ts`:
  - `spendableWax(p: ResourcePricing)` = `max(0, liquidWax - minLiquidReserve)` less the reserve buffer bps, so the estimate matches what the contract will actually release.
  - `waxCostForCheese(cheese, p)` — WAX the pool spends for a CHEESE spend, using the existing `waxPerCheese` and the buy spread already encoded in `feeBps`.
  - `maxCheeseForPool(p)` — inverse of the above, floored to CHEESE precision, so the autofill value is always safe.
- `src/components/air/AirdropContext.tsx`: derive `ramPoolWax { needed, spendable, overBy } | null` from the existing `ramCheeseTotal` and pricing, expose `ramPoolMaxViable { cheese, text }` and `applyRamPoolMax()` (mirroring the existing `ramMinViable` / `applyRamMinViable` pattern, including the CHEESE↔KB unit conversion and the fixed-mode divide by recipient count), push an `error`-level entry into the existing warnings list, and include it in the can-run gate.
- `src/components/air/AirDistributionCard.tsx`: warning block under the amount input with the clickable autofill button, styled like the existing below-minimum block.
- `src/components/air/AirCostPanel.tsx`: one Summary line showing WAX needed vs pool spendable when over the limit.
- Tests in `src/test/` for `spendableWax`, `waxCostForCheese`, `maxCheeseForPool` round-trip (autofilled amount must never exceed spendable WAX) and the reserve/buffer edge cases.
- Verify with a typecheck, the test run, and a preview check of the same pro-rata RAM scenario, without signing anything.

## Note

The figures are estimates: CHEESE and RAM prices move between the quote and the transaction, and the pool balance can change if someone else buys RAM first. The autofill leaves the contract's own safety buffer in place, so it stays conservative rather than exact.
