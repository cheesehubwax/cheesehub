# CHEESESwap manual pool sliders

## Goal
Keep CHEESESwap’s automatic best-price route as the default, while adding a Manual mode for users who want to deliberately send chosen percentages through particular pools—even when that is not the best-priced result.

## User experience
- Add an **Auto / Manual** switch beside the Multiroute heading.
- **Auto** remains exactly as it is now and continues choosing the best result.
- Switching to **Manual** starts from the current automatic split, then lets the user add or remove available routes.
- Each selected route shows its exchange logo, complete pool path, fee, a percentage slider, and a numeric percentage field.
- Alcor routes may be direct or multi-hop; Defibox and TacoSwap remain direct-pair routes because those are the transaction formats currently verified on-chain.
- Up to six selected routes can share one transaction, matching the existing router limit.
- Adjusting one route keeps its chosen value and proportionally redistributes the remainder across the other selected routes. Percentages use 1% steps and always total exactly 100%.
- Setting a route to 0% removes it from the transaction. A route that rounds below one smallest token unit is marked too small and cannot be submitted.
- **Reset to best route** returns to the current automatic result immediately.
- Manual mode is available only when the user enters the amount to spend. If the user switches to entering a desired receive amount, CHEESESwap returns to Auto and hides the manual controls.
- While a manual quote is recalculating, keep the chosen percentages visible but disable Swap so an old quote cannot be signed.
- Clearly label manual mode as user-selected routing and show price impact warnings without preventing an intentional, valid route.

## Route selection
- Provide a pool-route picker containing all currently usable routes for the selected token pair:
  - individual direct Alcor pools;
  - valid Alcor multi-hop paths, with every pool in the path shown;
  - each matching direct Defibox pool;
  - each matching direct TacoSwap pool.
- Sort choices by quoted output in spend mode or required input in receive mode, but do not silently remove worse-priced choices—the point of Manual mode is to let the user direct volume.
- Prevent duplicate routes and mixed-exchange paths.
- If a selected pool becomes unavailable, set it to 0%, redistribute its share, explain which route dropped, and require a fresh completed quote before Swap is enabled.

## Quote and transaction rules
- Represent allocations internally as integer basis points, normalize them to exactly 10,000, and derive raw token amounts with integer arithmetic.
- Validate manual percentages as bounded integers before quoting or building actions; reject malformed, non-finite, negative, over-100%, or non-totaling allocations.
- Assign each route its exact raw input and put the final rounding unit into the largest selected leg.
- Requote fixed Alcor paths directly rather than rerunning the optimizer; quote Defibox and TacoSwap pools with the existing contract-matched integer formulas.
- Rebuild every leg’s input, output, minimum received or maximum sent, memo, price impact, and aggregate totals whenever an allocation changes.
- Preserve the user’s aggregate slippage setting and the existing widened per-leg protection. Never reuse memos or amounts from the previous allocation.
- Keep one wallet signature and one atomic transaction containing one transfer per selected leg. If any leg fails, the entire swap transaction reverts.
- Refresh the relevant live pool state before enabling Swap, and reject stale, zero-output, over-reserve, or otherwise unquotable allocations.

## Implementation areas
- Add manual route/allocation request types and stable route identifiers to the swap data model.
- Extend the Alcor quote worker/core with fixed-route exact-input quoting, while leaving automatic optimization and exact-output quoting untouched.
- Pass manual mode and normalized allocations through the swap query key; skip Alcor’s HTTP auto quote while Manual mode is active because it cannot represent chosen splits.
- Add the Auto/Manual controls, route picker, sliders, numeric fields, reset action, unavailable-route state, and warnings to the swap panel.
- Audit the transaction builder so fixed-input legs use the selected raw amounts, sum exactly to the amount entered, and carry fresh per-leg minimum outputs.

## Verification
- Unit-test allocation normalization at 0/100, 1/99, equal three-way splits, slider redistribution, route removal, tiny amounts, and token-precision rounding.
- Test fixed-route quotes for direct and multi-hop Alcor routes plus direct Defibox and TacoSwap routes in spend mode.
- Confirm all raw leg amounts sum to the displayed aggregate and every memo contains the matching per-leg protection amount.
- Compare 100% manual routes against the same pool’s standalone quote, and compare the untouched Auto mode against today’s results.
- Browser-test adding routes, changing sliders, switching to receive mode (which must return to Auto), reset-to-best, stale/unavailable pools, mobile layout, and the final wallet transaction preview.
- Perform a small user-signed real swap for each venue before treating manual routing as fully proven on-chain.
