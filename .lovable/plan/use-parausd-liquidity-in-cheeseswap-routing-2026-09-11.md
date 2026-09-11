# Use PARAUSD liquidity in CHEESESwap routing

## Why quotes lose to Alcor

PARAUSD (contract `parareserves`) is a WAX stablecoin with very deep pools that Alcor's router happily hops through:

- WAXUSDC / PARAUSD (0.05% fee) — largest of the set
- WAXUSDT / PARAUSD (0.05%)
- PARAUSD / USDT (0.05%)
- WAX / PARAUSD (0.3% and 1%)
- plus many small game/app token pairs against PARAUSD

CHEESESwap's router keeps two curated lists of "hub" tokens used to rank and seed candidate pools. PARAUSD is in neither, so those pools are ranked as obscure and get dropped by the pool cap before pricing. Any route whose best path runs through PARAUSD is therefore never quoted, and Alcor wins on price.

## The change

1. Add `parausd-parareserves` to the general hub set so PARAUSD pools rank alongside WAX, USDT, USDC, WAXUSDC, WAXUSDT and LSWAX when candidate pools are ordered.
2. Add `parausd-parareserves` to the deterministic route-coverage set so PARAUSD is treated as a valid intermediary when seeding two-hop coverage and split legs. This is consistent with the existing set, which is stable/base assets only — PARAUSD is a stablecoin, not an app token.
3. Leave the small PARAUSD app-token pairs to normal ranking; no special-casing per token.
4. Verify against Alcor for a few pairs that should now improve (for example WAX→WAXUSDC, WAXUSDC→USDT, WAX→USDT) and confirm previously good pairs (WAX→CHEESE, WAX→WAXWBTC, WAX→WAXWETH) do not regress.

## Notes

- No contract, transaction, or execution changes — routing/quoting only; swaps still execute through Alcor's router as today.
- If PARAUSD-heavy routes push the candidate pool count against the current cap and quotes start returning fewer splits, the follow-up is a modest cap increase rather than removing hubs; that is only done if verification shows it is needed.

## Technical detail

- File: `src/lib/alcorRouter.ts`
- `HUB_KEYS`: add `"parausd-parareserves"`.
- `ROUTE_COVERAGE_HUB_KEYS`: add `"parausd-parareserves"`.
- No change to `routeCoverageHubKeys` special cases (WAXWETH, HOLE) or to `selectRelevantPools` logic/cap.
