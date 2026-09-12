# Fix the USD values in CHEESEAir LP snapshots

## What's wrong

The LP snapshot ranks providers by the wrong number. It reads Alcor's `depositedUSDTotal`, which is the dollar value of what the provider *originally deposited*, not what their position is worth today. Alcor's own interface shows the current value.

Confirmed against the live Alcor API:

- CHEESE/HOLE pool: `hole.cheese` shows `depositedUSDTotal` of **$1.06** while its position is currently worth **$1,261.42** — that is why by far the biggest provider appeared last.
- CHEESE/WAXUSDC pool: deposited totals add up to **$3,446** while the pool's actual value is **$2,693** — the gap the user noticed.
- Summing the current values instead matches Alcor's pool figure almost exactly (CHEESE/WAXUSDC: $2,698 vs $2,694 reported; CHEESE/WAX: $2,201 vs $2,198).

A second, smaller issue: positions that are currently out of range are dropped entirely, even though the money is still in the pool and Alcor counts it. In the CHEESE/WAX pool one such position is excluded today.

## The fix

1. Rank and weight providers by each position's **current** USD value (`totalValue` from Alcor), summed per account across all fee tiers of the pair.
2. Count open positions whether or not they are currently in range — the funds are still deposited. Closed positions and zero-value dust stay excluded.
3. If Alcor ever omits the current value for a position, fall back to the deposited figure for that row rather than dropping the provider.
4. No change to how the drop itself is split or sent — pro-rata simply now divides against correct weights.

After this, the holders list order and the dollar figures shown in CHEESEAir will line up with what Alcor shows for the same pool.

## Technical notes

- `src/lib/airdropAlcorLp.ts`, `getAlcorLpHolders`: add `totalValue?: number` to `RawPosition`; weight becomes `Number(pos.totalValue ?? pos.depositedUSDTotal ?? 0)`; drop the `inRange !== true` filter, keep `closed === true` and `liquidity > 0` filters and the `usd > 0` guard. Aggregation, sorting, `formatUsd` and the returned `HolderSnapshot` shape are unchanged, so no downstream changes are needed.
- Copy touch-up where the snapshot describes the list as in-range positions (`AirSnapshotCard.tsx` / `AirHoldersTable.tsx` note text, and `AirInfoDropdown` if it repeats it) so wording matches the new behaviour.
- Verification: query pools 11051, 5181 and 1252 and confirm the per-account totals sum to Alcor's `tvlUSD` for each; then load `/air`, pick CHEESE/HOLE, and confirm `hole.cheese` ranks first with roughly $1,261 and `liquidcheese` second with roughly $140-scale-corrected value; run typecheck and a production build.
