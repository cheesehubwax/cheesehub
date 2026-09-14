# Move CHEESEAnal pools table 24h column next to USD value

## Current state
The pools table columns are: Pool, Venue, USD value, CHEESE, Paired token, CHEESE price (in pair), Accounts, 24h.

The 24h figure is the percentage change in each pool’s **USD value** compared with the recorded snapshot closest to 24 hours earlier (`change(pool.usd, before.usd)`).

## Change
Move the **24h** column so it sits immediately after **USD value** and before **CHEESE**, making the logical flow: USD value → 24h change → CHEESE amount → paired token → price → accounts.

## Files
- `src/components/anal/AnalPoolTable.tsx`: reorder the `<th>` and matching `<td>` cells.

## Verification
- Open `/anal` and confirm the pools table header order is Pool, Venue, USD value, 24h, CHEESE, Paired token, CHEESE price (in pair), Accounts.
- Confirm 24h values still colour green/red correctly and show `—` when no prior snapshot exists.
- Run TypeScript typecheck and confirm the production build is clean.
