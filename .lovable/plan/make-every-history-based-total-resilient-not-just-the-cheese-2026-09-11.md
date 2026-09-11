# Make every history-based total resilient, not just the CHEESENull leaderboard

## What I confirmed just now

I asked four history providers for exactly the same "CHEESE sent to eosio.null" records. They disagree wildly — every one of them is missing records the others have:

| contract | eosusa | waxsweden | hivebp | cryptolions |
|---|---|---|---|---|
| cheesefeefee | 3 (341.59) | 0 | 0 | 7 (657.13) |
| cheesebannad | failed | 30 (186.08) | 72 (454.58) | 199 (1,374.60) |
| cheesenftwax | 0 | 4 (4,680) | 16 (14,190) | 40 (48,289.42) |
| liquidcheese | 3 (1,081.37) | 8 (1,815.52) | 22 (2,900.86) | 52 (4,308.78) |

So the Null-by-contract breakdown is wrong for the same reason the leaderboard was: it picks **one** provider and trusts whatever it returns. Its freshness probe only checks how recently a provider indexed a block — a provider can be perfectly up to date and still be missing most of the past. Nobody can tell which single provider is complete, so the only safe answer is the union of all of them.

## The fix

1. Add one shared helper for "read a full action history reliably": query several providers in parallel, paginate each, merge the results and de-duplicate every record by its unique on-chain identity, then return the union. This is exactly what CHEESENull's leaderboard now does — this makes it reusable instead of copied.
2. Rebuild the Null-by-contract breakdown on that helper: lifetime, 24h, 7d and 30d amounts per contract all become unions across providers instead of one provider's slice. Drop the freshness-probe endpoint picking, which cannot detect missing history.
3. Keep the on-chain authoritative counters where they already exist (cheeseburner and cheesepowerz read their own contract tables); those stay preferred, with the union used for the time windows and for contracts that have no counter.
4. Show a quiet "history may be incomplete" note on the breakdown when fewer than two providers answered, matching the leaderboard's note.
5. Apply the same union treatment to the other places that add up history and currently trust one answer:
   - CHEESEAds stats (fees paid out and CHEESE nulled by the banner contract) — currently hard-wired to the single provider that is worst affected.
   - CHEESEDrop purchase log and revenue totals — currently first-provider-wins.
   - CHEESEFarm claim totals — currently first-provider-wins.
6. Fix the single-provider reads in CHEESEDao: its proposals, treasury and table reads all go to one provider with no fallback, so that page fails outright when that provider is down. Route them through the existing multi-endpoint table reader.
7. Verify after the change: the breakdown's per-contract numbers are at least as high as the best single provider above (cheesenftwax around 48,289, liquidcheese around 4,309, cheesebannad around 1,375), percentages still total 100%, and CHEESEAds / CHEESEDrop / CHEESEFarm totals are unchanged or higher — never lower.

Note on expectations: a union is the most complete view obtainable from public providers, but if every provider is missing the same record no front end can recover it. Totals may therefore still rise later as providers re-index; they will no longer drop because of one bad provider.

## Technical detail

- New `src/lib/hyperionHistory.ts`: `fetchActionsUnion({ path/params, endpoints })` — `Promise.allSettled` across providers, per-provider pagination (1000/page, existing caps), abort timeout per request, de-dupe key `gs:<global_sequence>` falling back to `<trx_id>:<action_ordinal>`; returns `{ actions, endpointsSucceeded, bestEndpointCount }`. Extract the identity/timeout logic currently in `fetchLeaderboard.ts` and have that file re-use it.
- `src/lib/cheeseNullBreakdown.ts`: delete `pickHyperionEndpoint`; `fetchContractNulledFromHyperion` and `fetchCheesepowerzReceivedWindow` become union reads summing `act.data.quantity`. Return coverage info alongside the entries so the UI can flag it. Keep `fetchContractStats` / cheesepowerz `stats` as authoritative lifetime values.
- `src/hooks/useNullBreakdown.ts` + the breakdown popover component: carry an `isPartial` flag through, render the same note style as `NullerLeaderboard`.
- `src/lib/bannerAdStats.ts`: replace the single `HYPERION_ENDPOINT` with the shared union helper over the standard endpoint list.
- `src/hooks/useDropPurchases.ts`, `src/lib/farmClaimHistory.ts`: replace first-success loops with the union helper for the counting/summing paths (single-transaction lookups can stay first-success).
- `src/lib/dao.ts`: swap the hard-coded `https://wax.eosusa.io/v1/chain/...` calls for `fetchTableRows` from `src/lib/waxRpcFallback.ts`, and the proposals history call for the union helper.
- Read-only data paths only: no contract, transaction, or schema changes.
