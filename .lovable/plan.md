# Fix: Alcor HOLE/CHEESE pool missing from HOLE snapshots

## Problem
Alcor reports `tvlUSD: 0` for its biggest HOLE pool (HOLE/CHEESE, pool 11051, ~$2,300 across 18 positions). HOLE discovery applies the $100 minimum using Alcor's own TVL figure, so the pool is silently dropped from HOLE snapshots. CHEESE snapshots already record it because CHEESE/HOLE is on the explicit tracked list.

## Fix
In `src/lib/lpPools.ts` (`alcorCheesePairs`), stop trusting Alcor's `tvlUSD` for the selection floor. Compute each pair's TVL ourselves from the pool reserves (`tokenA.quantity`/`tokenB.quantity`) multiplied by the USD prices we already fetch (`system_price` bridged through WAXUSDC — CHEESE and HOLE both have one). Alcor's `tvlUSD` remains only as a fallback when a token has no known USD price.

- Thread the existing `UsdPrices` map into `alcorCheesePairs` (called from `scripts/lp-history/sample.ts`; signature change ripples to any other callers — update them all).
- With the derived TVL, HOLE/CHEESE on Alcor (~$4,600 by reserves) clears the $100 floor and is recorded on the HOLE tab; the tiny WAX/HOLE pool (~$13) stays excluded.
- Pool snapshot values already come from position totals, so the recorded HOLE/CHEESE figures will be correct once the pool is selected.

## Verification
- Update `src/test/lpPools.test.ts` with a HOLE fixture where `tvlUSD` is 0 but reserves are large — asserts the pair is selected.
- Dry-run the sampler with `LP_TOKEN=hole` and confirm the output lists `alcor HOLE / CHEESE` with the expected ~$2,300 position-derived value.
- Typecheck + focused tests + preview build.

## Out of scope
- No changes to Taco/Defibox readers, the workflow, or any UI.
