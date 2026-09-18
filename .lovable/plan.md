# CHEESEAnal — richer tooltips on the main graph

Short answer: yes, all six are possible from the recorded snapshots. Five come straight from the small history index already loaded. Provider/position names live inside the per-snapshot files, so those two need the hovered snapshot (and the one before it) to be loaded when you hover — cached after the first time.

## What each tooltip will show

- **CHEESE price** — price plus `+/-x.xx%` vs the previous snapshot.
- **Total liquidity** — USD value plus its WAX equivalent (e.g. `$15,347 · 9,712 WAX`).
- **CHEESE in pools** — amount plus `+/-x.xx%` vs the previous snapshot.
- **Providers** — count, the change (`+2 / -1`), and the account names that joined or left.
- **Positions** — count, the change, and which accounts added or closed positions (e.g. `hole.cheese +1`).
- **Total volume** — volume plus `+/-x.xx%` vs the previous recorded volume snapshot.

Where a comparison isn't possible (first snapshot, or a snapshot with no recorded volume), the tooltip simply omits the change line rather than showing a misleading 0%.

Account lists are capped (first few names, then "+N more") so the tooltip stays readable, and while the snapshot files are still loading the tooltip shows "loading accounts…".

## Technical notes

- Percent changes use `change()` from `src/components/anal/format.ts` against the previous entry of the same ranged series in `AnalOverview.tsx`.
- WAX value: snapshots don't store a WAX/USD price, but it is derivable per snapshot from the CHEESE/WAX pair — `waxUsd = priceUsd / priceInPaired` on the `wax-eosio.token` pair. Total liquidity in WAX = `usd / waxUsd`. If that pair is missing from a snapshot (e.g. Defibox-only venue filter), the WAX line is omitted. No live prices — snapshot-only stays intact.
- Provider/position attribution: `useLpDay(date)` already fetches a full snapshot file with `pool.providers[]` (account, usd, cheese, paired, pos). On hover, load the hovered snapshot and its predecessor via the same cached hook, apply the active venue filter, build per-account position totals for each, and diff the two account sets.
- Loading is triggered only for the hovered point and kept in the react-query cache, so scrubbing the chart re-reads nothing.
- Work is confined to `src/components/anal/AnalOverview.tsx`, a small tooltip component alongside it, and a helper for the snapshot diff; chart data, sampler, and workflow are unchanged.
