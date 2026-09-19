# CHEESEAnal — richer tooltips on every mini graph

Add snapshot-to-snapshot context to all six pool-history graphs and both account-detail graphs, matching the richer main graph while keeping every figure historical and snapshot-only.

## Pool history tooltips

- **CHEESE price in pair** — show the pair price and its percentage change since the previous snapshot.
- **Pool value (USD)** — show USD value, its WAX equivalent at that snapshot, and percentage change since the previous snapshot.
- **CHEESE in pool** — show the amount and percentage change since the previous snapshot.
- **Paired token in pool** — show the token amount and percentage change since the previous snapshot.
- **Provider accounts** — show the count and change, plus names of accounts that joined or left that specific pool. Also list accounts whose position count changed.
- **Volume (24h)** — show USD volume and percentage change from the previous snapshot that actually recorded volume, skipping the expected empty twice-daily points.

## Account detail tooltips

- **Position value (USD)** — show the account’s value, percentage change since its previous snapshot, and the WAX equivalent for that snapshot.
- **CHEESE in positions** — show the CHEESE amount and percentage change since the previous snapshot.
- In the **All pools** view, also identify which pools changed for that account; in a selected-pool view, keep the detail limited to that pool.

## Behaviour and edge cases

- Compare against the preceding recorded point inside the selected date range; volume compares against the preceding non-empty volume sample.
- Treat a missing account or pool in the earlier snapshot as zero where that represents a genuine join/open, while avoiding fabricated changes when a snapshot is marked partial for that venue.
- Load full snapshot files only while hovering where account-level attribution is needed, and reuse the existing query cache.
- Cap account and pool lists with a “+N more” suffix so tooltips remain readable.
- On the first comparable point, show “first recorded snapshot”; while detail files load, show a short loading line.
- Preserve the existing graph sizes, colors, ordering, value boxes, range/venue filtering, and workflow data format.

## Technical scope

- Extend the existing snapshot-diff helpers with pool-specific provider/position diffs and account-per-pool changes.
- Add a shared mini-chart tooltip renderer so all eight mini graphs format changes consistently.
- Pass the already-loaded ranged index data into account detail for snapshot WAX conversion without any live request.
- Add focused tests for percentage comparisons, missing volume samples, pool joins/leaves, account pool changes, partial snapshots, and WAX conversion.
- Verify pool and account hover states in the browser, then confirm type checks, focused tests, and the preview build are clean.
