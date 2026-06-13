## Goal

Make the "Null by contract" breakdown's 24h / 7d / 30d columns for `cheesepowerz` consistent with the lifetime column (and with what users see on the homepage total). Today the lifetime column reads `cheesepowerz::stats.total_cheese_received` (incoming CHEESE = nulled CHEESE, since 100% pass-through), but the window columns query Hyperion for outgoing `transfer cheesepowerz → eosio.null`, which misses nulls done via `cheeseburger::retire` and lags badly on indexer delay.

## Change

In `src/lib/cheeseNullBreakdown.ts`, add a dedicated window fetcher for `cheesepowerz` that mirrors the lifetime semantics: query Hyperion for **incoming CHEESE transfers to `cheesepowerz`** in the window, instead of outgoing transfers to `eosio.null`.

### Specifics

1. Add `fetchCheesepowerzReceivedWindow(after: string)`:
   - Same multi-endpoint + staleness probing as the existing helper (reuse `pickHyperionEndpoint()`).
   - Query: `act.account=cheeseburger&act.name=transfer&transfer.to=cheesepowerz&limit=1000&skip=...&after=<iso>`.
   - Sum `act.data.quantity` (CHEESE asset). Paginate with the existing `BATCH_SIZE` / `MAX_ACTIONS` guards.

2. In `fetchNullBreakdown()`, branch per contract for the window fetches:
   - For `cheesepowerz`: use `fetchCheesepowerzReceivedWindow(after)` for `amount24h` / `amount7d` / `amount30d`.
   - For all other contracts: keep the existing `fetchContractNulledFromHyperion(account, after)`.

3. Leave the lifetime path untouched (still `total_cheese_received` for cheesepowerz; still `total_cheese_burned` for cheeseburner; still Hyperion for the rest).

4. No UI changes — the column already says "nulled". Because 100% of CHEESE received by `cheesepowerz` is nulled, "received in window" is a correct measure of "nulled in window" for this contract, with no end-user-visible terminology drift.

### Why this is correct, not a workaround

- The contract's own counter is the source of truth for cheesepowerz. The lifetime column already trusts it; the window columns should be derived from the same event stream (inflows), not from a second, divergent stream (outgoing eosio.null transfers) that can be implemented via `retire` and miss entirely.
- This eliminates a class of silent drift: any future change in how cheesepowerz performs the null (retire vs. transfer-to-null vs. batched) will not break the windows.

## Files touched

- `src/lib/cheeseNullBreakdown.ts` — add helper, branch in `fetchNullBreakdown`.

## Out of scope

- Other contracts in the breakdown (cheeseburner, cheesefeefee, cheesebannad, cheesenftwax, liquidcheese) — they keep their current outgoing-to-`eosio.null` window query, which matches how they actually null.
- Any UI/tooltip changes.
- Caching changes (existing `useNullBreakdown` staleTime/enabled behavior is unchanged).

## Verification

After deploy, trigger a fresh daily-powerup run (or wait for the next scheduled one). Within ~1 minute of the on-chain action being indexed, the cheesepowerz 24h column should increase by the CHEESE amount sent in that run (e.g. +13 CHEESE for a 13-account / 1 CHEESE-each run), matching the lifetime delta and the homepage total delta.
