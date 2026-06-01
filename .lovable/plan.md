## Problem

The homepage "Null breakdown by contract" stopped recording today's nulls because `src/lib/cheeseNullBreakdown.ts` only queries one Hyperion endpoint (`wax.eosusa.io`), and that indexer is currently ~14h behind the chain (`last_indexed_block_time: 2026-05-31T18:12:55`, while today is 2026-06-01). All non-cheesepowerz contracts depend entirely on this one endpoint, and even cheesepowerz's 24h/7d/30d windows do.

The contracts are fine — nulls are still happening on-chain; we just aren't seeing them through that one stale Hyperion.

## Fix

Mirror the resilience pattern already used elsewhere in the app (multi-endpoint fallback + freshness check):

1. **Replace the single `HYPERION_ENDPOINT` constant** in `src/lib/cheeseNullBreakdown.ts` with an ordered list of Hyperion endpoints, e.g.:
   - `https://wax.eosusa.io/v2/history/get_actions`
   - `https://wax.hivebp.io/v2/history/get_actions`
   - `https://api.waxsweden.org/v2/history/get_actions`
   - `https://wax.greymass.com/v2/history/get_actions`

2. **Update `fetchContractNulledFromHyperion`** so it:
   - Tries each endpoint in order.
   - On the first response, checks `last_indexed_block_time`; if it is more than ~10 minutes behind `Date.now()`, treats that endpoint as stale and moves to the next one.
   - Only accepts the result once it gets a fresh endpoint (or, as a last resort, falls back to the freshest of the stale ones rather than returning 0).
   - Keeps the existing pagination loop unchanged once an endpoint is selected.

3. **No changes** to the public API (`fetchNullBreakdown`), the React Query hook (`useNullBreakdown`), or any UI. The breakdown popover will simply start showing today's data again the moment any healthy Hyperion is reachable.

## Out of scope

- No contract changes, no UI changes, no caching changes.
- Not touching wallet/balance code; it already has its own fallback.
- Not changing cheesepowerz's on-chain `stats` read (it's already authoritative for the all-time number).

## Technical notes

- Staleness threshold: 10 minutes is generous enough to tolerate normal indexer lag but tight enough to catch a half-day-behind node like the current eosusa snapshot.
- Endpoint list should be a module-level `const`; no need for env config.
- Keep the function signature `fetchContractNulledFromHyperion(account, after?)` unchanged so the 24h/7d/30d call sites in `fetchNullBreakdown` keep working as-is.
