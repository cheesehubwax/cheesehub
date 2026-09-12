# Make CHEESEAnal snapshot-only

## Confirmed current behavior

- CHEESEAnal loads the latest full workflow snapshot, but falls back to a live exchange query when that snapshot is unavailable.
- The pools table’s **CHEESE price (in pair)** comes from that selected current dataset, so it can become live data during the fallback.
- The **24h** column compares each current pool value with the preceding recorded index point. It normally uses snapshots, but its current side can also become live during the fallback.
- Pool detail values, provider tables, account holdings, exports, and overview values share the same current dataset and therefore inherit the same fallback risk.
- Graph series already come from recorded workflow index files.

## Changes

1. Remove the live liquidity query and live-data fallback from the CHEESEAnal page.
2. Use only the newest recorded full snapshot for all current values, tables, pool details, account holdings, and snapshot CSV exports.
3. Keep historical graphs and comparisons sourced only from recorded workflow index snapshots.
4. When no snapshot exists—or the newest full snapshot cannot be loaded—show an honest snapshot-unavailable state instead of substituting live figures.
5. Replace live-refresh and live-failure messaging with snapshot-specific refresh, loading, partial-snapshot, and error messaging.
6. Update stale comments and explanatory text so the interface consistently states that all CHEESEAnal figures come from workflow snapshots.

## Validation

- Verify the pools table price and 24h values match the newest and preceding recorded snapshot data.
- Verify overview boxes, pool/provider tables, account details, charts, and CSV exports contain no live venue values.
- Check the snapshot-missing/error state, TypeScript, focused tests, production build, and `/anal` in the browser.
