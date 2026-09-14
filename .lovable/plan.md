# Add 24h CHEESE price-in-pair change column to CHEESEAnal pools table

## Current state
The pools table columns are: Pool, Venue, USD value, 24h (USD change), CHEESE, Paired token, CHEESE price (in pair), Accounts.

The existing 24h column compares each pool’s current USD value with the recorded snapshot closest to 24 hours earlier (`change(pool.usd, before.usd)`).

## Change
Add a second 24h-style column that tracks the percentage change in **CHEESE price in the paired token**, placed immediately after the **CHEESE price (in pair)** column.

- Header label: **24h price**.
- Value: percentage change between `pool.priceInPaired` and the same pool’s `priceInPaired` from the snapshot closest to 24 hours earlier.
- Reuse the existing `change()` formatter; render green for positive or zero change, red for negative, and `—` when either the current or previous price is missing or non-positive.

## Files
- `src/components/anal/AnalPoolTable.tsx`: add the new `<th>` after the price header and the matching `<td>` cell after the price cell.

## Verification
- Open `/anal` and confirm the pools table header order is Pool, Venue, USD value, 24h, CHEESE, Paired token, CHEESE price (in pair), 24h price, Accounts.
- Confirm the new column shows signed percentages (e.g., `+1.23%`, `-0.45%`) and `—` when no comparable prior snapshot exists.
- Confirm colours match the existing 24h column style.
- Run TypeScript typecheck and confirm the production build is clean.
