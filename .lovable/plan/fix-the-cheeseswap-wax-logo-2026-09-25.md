# Fix the CHEESESwap WAX logo

## Changes
- Make the existing bundled WAX coin artwork the canonical logo for `WAX` from `eosio.token`.
- Route CHEESESwap’s logo helper through the shared local-logo resolver so the multiroute display does not depend on Alcor’s remote image endpoint.
- Add focused tests confirming WAX and CHEESE resolve to bundled deployment-safe assets while other tokens retain remote logo lookup.

## Verification
- Run the CHEESESwap component test and the full TypeScript check.
- Confirm the production build succeeds and inspect the rendered logo source when practical.
