## Diagnosis

WAX→WAXWETH is not failing for the same reason as WAX→WAXWBTC.

The current seeding already includes the WAXUSDC and WAXWBTC WAXWETH legs, and a local SDK diagnostic proves the split router can produce multi-split WAXWETH routes. The missing piece is Alcor's best WAX→WAXWETH route: it currently goes heavily through CHEESE (`WAX → CHEESE → WAXWETH`, pools `1252,7801`).

That route is being excluded because `ROUTE_COVERAGE_HUB_KEYS` intentionally removed app/social tokens, while `HUB_KEYS` still treats CHEESE as a normal high-priority hub. So the ranked pool cap includes many less useful pools, but the deterministic endpoint seeder does not seed the CHEESE connector that Alcor is actually using for WAXWETH.

## Plan

1. Update `src/lib/alcorRouter.ts` so deterministic route coverage includes CHEESE only as a controlled known hub, matching the existing broader `HUB_KEYS` behavior.
2. Keep the fix narrow: do not add arbitrary social tokens, do not change execution memos, slippage, percent grid, or HTTP fallback selection.
3. Add/adjust router diagnostics comments so it is clear why CHEESE is allowed for endpoint seeding while other app/social tokens remain excluded.
4. Verify with WAX→WAXWETH and WAX→WAXWBTC SDK quotes:
   - WAX→WAXWETH should include the `WAX → CHEESE → WAXWETH` leg and beat the single HTTP route.
   - WAX→WAXWBTC should keep the existing split behavior as a regression check.

## Technical details

Expected minimal code change: add `cheese-cheeseburger` to `ROUTE_COVERAGE_HUB_KEYS` in `src/lib/alcorRouter.ts`, preserving the hub-restricted approach but aligning deterministic coverage with the existing `HUB_KEYS` ranking for CHEESE.