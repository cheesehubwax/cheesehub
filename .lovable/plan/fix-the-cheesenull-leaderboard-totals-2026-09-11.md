# Fix the CHEESENull leaderboard totals

## What's actually wrong

The leaderboard is built by reading the full history of `cheeseburner` null events from one single history provider (`wax.eosusa.io`). I queried the live providers just now for exactly the same history:

- `wax.eosusa.io` — 26 events (and it also timed out on repeat calls)
- `api.waxsweden.org` — 31 events
- `wax.cryptolions.io` — 190 events, oldest 2026-02-13, newest today 03:00 UTC, 1,939.83 CHEESE nulled in total

So nothing changed on the site or on chain — the provider CHEESENull depends on has lost most of its index for this contract and is now returning a small slice of the history. Every ranking and total is computed from that slice, which is why the numbers suddenly dropped. Top nullers from the complete 190-event set: 1gooeycheesy 467.22, m23qs.wam 366.10, ugxaa.c.wam 355.57, ftxxq.wam 255.17, dr.cheese 141.93.

## The fix

1. Query several history providers instead of one, in the multi-endpoint style already used elsewhere on CHEESEHub, and keep the most complete result rather than the first one that answers. Provider list to try: cryptolions, waxsweden, eosusa, eosphere, blokcrafters.
2. Merge results across providers and de-duplicate each event by transaction id plus action position, so a provider returning overlapping or repeated records can't inflate counts.
3. Treat a clearly short answer as suspect: if the best provider returns fewer events than the highest count seen (or fewer than the last good result cached in the browser), prefer the larger set instead of overwriting good data with a truncated one.
4. Show a small "history may be incomplete" note on the leaderboard when every provider failed or all of them came back short, so a thin index is visible rather than silently wrong.
5. Apply the same multi-provider handling to the CHEESEUp nullers leaderboard, which shares the identical single-pass pattern and picks whichever provider answers first — it is exposed to the same failure.
6. Verify after the change that CHEESENull shows the full 190 events / 1,939.83 CHEESE nulled and the ranking above, and that CHEESEUp's leaderboard is unchanged or higher.

## Technical detail

- `src/lib/fetchLeaderboard.ts`: replace the single `HYPERION_ENDPOINT` with an endpoint list; fetch each with a timeout, paginate as today, return the union keyed by `trx_id:action_ordinal`; keep the largest coverage rather than the first success. Include `trx_id` and `action_ordinal` in the parsed action shape.
- `src/hooks/useNullerLeaderboard.ts`: persist the last good action count so a later truncated fetch does not replace a fuller one; expose an `isPartial` flag.
- `src/components/cheesenull/NullerLeaderboard.tsx`: render the incomplete-history note from that flag.
- `src/lib/fetchPowerupLeaderboard.ts`: same union + de-dupe + best-coverage selection over its endpoint list.
- No contract, transaction, or schema changes; read-only data path only.
