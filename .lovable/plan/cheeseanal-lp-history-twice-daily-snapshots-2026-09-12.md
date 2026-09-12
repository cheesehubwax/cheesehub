# CHEESEAnal LP history — twice-daily snapshots

## Goal
Switch the CHEESEAnal LP history workflow from one snapshot per UTC day to two (one in each 12-hour slot), mirroring the RAM price history workflow, so charts get twice the granularity.

## How it works today
- `.github/workflows/lp-history.yml` runs 3 cron ticks in the morning; `scripts/lp-history/sample.ts` keys each snapshot by UTC date (`YYYY-MM-DD`), writes `days/<date>.json`, and skips when that day already has a snapshot (unless `force=1`).
- The frontend reads the index and day files by that same date key; charts sort keys lexicographically and format labels via `shortDate`, which assumes a bare `YYYY-MM-DD`.

## Changes

### 1. Sampler — slot keying (same pattern as `scripts/ram-price-history/sample.ts`)
- `scripts/lp-history/sample.ts`: each run resolves to its 12h slot key `YYYY-MM-DDTHH` where HH is `00` or `12` (e.g. `2026-09-12T12`), mirroring the RAM sampler's `slotStart` logic.
- Snapshot file becomes `days/<slot>.json`; the index `date` field stores the slot key. Lexicographic sort order is preserved, and old day-keyed files (`2026-09-12`) still sort correctly alongside new slot keys.
- Dedup checks the current slot instead of the day: a delayed cron tick still lands in its slot, and extra ticks are no-ops. `FORCE=1` re-records the current slot; `reset=1` unchanged (wipes everything).
- Header comments updated to describe twice-daily sampling.

### 2. Workflow schedule
- `.github/workflows/lp-history.yml`: add three afternoon/evening ticks for the second slot (e.g. `41 13`, `41 16`, `41 21`) alongside the existing `41 1/4/9`, matching the RAM workflow's 3-ticks-per-slot pattern. Update the schedule comment, the `force` input description ("this 12h slot"), and the commit message to include the slot.

### 3. Frontend formatting
- `src/components/anal/format.ts`: `shortDate` handles both `YYYY-MM-DD` (legacy) and `YYYY-MM-DDTHH` slot keys — axis ticks show the date; when a slot is present, tooltips show date plus the slot time (e.g. "12 Sep · 12:00 UTC"). Applied in `AnalOverview.tsx`, `AnalPoolDetail.tsx`, `AnalAccountPanel.tsx` tooltips.
- `src/lib/lpPools.ts`: bump `mergeIndexDay` retention from 800 to 1600 entries so history still spans ~800 days at two snapshots per day; update comments noting `date` may be a slot key.
- No other frontend logic changes: chart series, account history (`useLpAccountHistory`), and CSV exports (`src/lib/lpCsv.ts`) key off the same string, so they pick up slot-keyed files automatically.

### 4. Compatibility
- Existing day-keyed snapshots remain valid points on the charts; the first slot run of a given day adds a second point rather than replacing the legacy one.
- CSV filenames/headers already include the snapshot key, so exported names naturally become `...-2026-09-12T12.csv`.

## Verification
- Run the LP pool unit tests (`src/test/lpPools.test.ts`) — fixtures updated where they assume day keys.
- Typecheck + production build pass.
- Sanity-check `shortDate` output for both key formats.
- After merging, trigger the workflow manually (or wait for the next tick) and confirm a `days/<date>T<slot>.json` file appears on the `lp-history-data` branch and CHEESEAnal renders the new point.
