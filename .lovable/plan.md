# Harden daily-powerup reads with triple-scan + merge

## Why
`scripts/daily-powerup/waxRpc.ts::fetchTableAll` already fails over across 4 RPC endpoints per page, but only does a single linear pass. If any endpoint returns an HTTP-200 page that's silently truncated (or `more=false` prematurely), eligible stakers get skipped until the next day's run. Arne's friend's "scan 3 times" suggestion is the right fix.

Action submission already has redundancy (`waxSign.ts` multi-endpoint `fetch` + `run.ts` batch bisect), so no changes needed there.

We do not persist `get_table_rows` output anywhere — the GitHub Actions runner is ephemeral and nothing is uploaded as an artifact or committed. Point 3 of the friend's advice does not apply.

## Changes

### `scripts/daily-powerup/run.ts`
Replace the single `fetchTableAll(...)` read of `cheesecheese::staketable` with **three independent scans**, each starting from a different endpoint in the rotation so a bad endpoint cannot poison all three passes. Merge results by `staker` (dedup, keep highest `cheesestaked` seen across passes for safety).

- Log per-scan row counts and the merged distinct-staker count.
- If any scan returns < 90% of the largest scan's count, log a `WARN` line (visible in Actions output) — does not abort, since the merged set is still the safest answer.
- Total added latency: ~2-4s for two extra full table scans (staketable has a few thousand rows). Acceptable inside the 15-minute job timeout.

### `scripts/daily-powerup/waxRpc.ts`
Add an optional `startEndpointIndex` parameter to `fetchTableAll` so each of the three scans can start from a different endpoint in the `ENDPOINTS` array (round-robin: 0, 1, 2). Existing per-page fallback behavior is preserved — `startEndpointIndex` only rotates the *preferred* endpoint, the others still serve as fallback.

No other files change. No workflow / cron / secrets / variables changes.

## Verification
- Run the workflow with `dry_run=1` and confirm the log shows three scans, their individual counts, the merged count, and the projected CHEESE spend matching the merged count.
- Confirm `eligible (>= MIN_STAKED CHEESE): N` matches the merged distinct-staker count from the three passes.
