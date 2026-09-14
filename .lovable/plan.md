# Fix the CHEESEDrop stat numbers

## What I confirmed

The four CHEESEDrop stat boxes (CHEESE Collected, CHEESE Nulled, xCHEESE Value, cheesereserv) are read from one blockchain history provider at a time, trying `wax.eosusa.io` first and only moving on if it errors. I queried the same records across five providers just now:

| records | eosusa | waxsweden | hivebp | cryptolions | eosphere |
|---|---|---|---|---|---|
| CHEESE collected (from nfthivedrops) | 0 | 8,950 | 25,850 | 88,081 | 88,081 |
| nulled (to eosio.null) | 660 | 5,340 | 14,850 | 48,949.42 | 48,949.42 |
| to xcheeseliqst | 220 | 1,780 | 4,550 | 14,288.67 | 14,288.67 |
| to cheesereserv | 220 | 1,780 | 4,550 | 13,506.27 | 13,506.27 |

`eosusa` answers successfully but with almost no history, so nothing triggers the fallback and the page shows near-zero totals. The same file also reads the drops and drop-prices tables straight from `eosusa` with no fallback, so the active-drop count is exposed to the same source.

## The fix

1. Read the four totals through the shared multi-provider history reader already used by CHEESENull, CHEESEUp, CHEESEAds, CHEESEFarm and the drop purchase log: query several providers, merge the records, de-duplicate each by its unique on-chain identity, and sum the union instead of trusting one provider.
2. Drop `eosusa` from the provider list used here and use the verified healthy set (cryptolions, eosphere, hivebp), matching the other history screens.
3. Read the drops and drop-prices tables through the existing multi-endpoint table reader so the active-drop count no longer depends on a single node.
4. Show a dash rather than 0 when every provider fails, so an outage can never look like "nothing was collected".
5. Verify after the change that the stats bar shows roughly 88,081 collected, 48,949 nulled, 14,288 xCHEESE and 13,506 cheesereserv, and that the active-drop count is unchanged.

## Technical detail

- `src/services/atomicApi.ts`: replace `fetchCheeseTransfersHyperion`'s single-endpoint loop with `fetchActionsUnion` from `src/lib/hyperionHistory.ts` (query string `act.account=cheeseburger&act.name=transfer&transfer.from=...&transfer.to=...&after=<DROPS_START_DATE>`), summing `act.data.quantity` over the de-duplicated union; return coverage info alongside the total. Replace the two inline `wax.eosusa.io/v1/chain/get_table_rows` calls with `fetchTableRows` from `src/lib/waxRpcFallback.ts` (paginating `drops` past the 1000-row limit). Remove `HYPERION_ENDPOINTS_DROPS`/`DROPS_BATCH_SIZE` in favour of the shared endpoint list.
- `CheeseDropStats` gains a partial/unavailable flag; `src/pages/Drops.tsx` and `src/components/drops/DropStatsBar.tsx` render `-` for values that could not be read instead of `0`.
- Read-only data path: no contract, transaction or schema changes.
