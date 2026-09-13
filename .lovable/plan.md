# True 24h comparison in the CHEESEAnal pools table

## Goal

The pools table "24h" column currently compares each pool's USD value against the **previous recorded snapshot** (about 12h earlier with twice-daily snapshots). Change it to compare against the snapshot closest to **24 hours before the current snapshot**.

## Changes

1. **Snapshot selection** (`src/components/anal/AnalPoolTable.tsx`):
   - Instead of `days[days.length - 2]`, find the recorded index entry whose timestamp (`t`, epoch ms) is closest to `current.t - 24h` (within a tolerance of a few hours; e.g. pick the entry with minimum distance to that target).
   - If no entry exists that is at least ~12h older than the current snapshot (i.e. too early in history for a meaningful 24h compare), show `—` rather than comparing to a 12h-ago snapshot.

2. **Fallback**: keep comparing USD value of the pool (`pool.usd` vs `before.usd`) — only the comparison target changes.

3. **Tests** (`src/test/lpPools.test.ts` or a small new test): verify the picker chooses the ~24h-ago snapshot when slots at 00/12 exist, and returns null when history is too short.

## Technical details

- `LpIndexDay` already carries `t` (epoch ms) for each snapshot, including legacy day-key entries, so no data changes are needed.
- Column header stays "24h" since it will now be a true ~24-hour comparison.
