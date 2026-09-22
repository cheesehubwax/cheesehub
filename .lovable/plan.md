# Add average columns to Null by Contract

## Goal
Show, for each contract in the Null Breakdown table, a daily average for each period already displayed: 24h, 7d and 30d.

## What the averages mean
- 24h avg = the 24h amount divided by 1 day (the hourly-rate-free, plain per-day figure for the last day).
- 7d avg = the 7d amount divided by 7.
- 30d avg = the 30d amount divided by 30.

All three are "CHEESE nulled per day" so the three numbers are directly comparable: a 24h average far above the 30d average means nulling has sped up.

## Changes
1. **Breakdown data** (`src/lib/cheeseNullBreakdown.ts`)
   - Add `avg24h`, `avg7d`, `avg30d` to `NullBreakdownEntry`, computed from the existing period amounts divided by 1, 7 and 30 days respectively.
   - No new chain reads: the period amounts are already collected, so opening the table stays as fast as it is now.

2. **Table** (`src/components/home/TokenStatsBanner.tsx`)
   - Add three columns, each immediately after its period's `%` column: `24h avg/day`, `7d avg/day`, `30d avg/day`.
   - Format with the same `formatFullNumber` + yellow CHEESE label used by the amount cells, right-aligned, muted so the totals stay the visual focus.
   - Column order becomes: Contract, 24h, 24h %, 24h avg/day, 7d, 7d %, 7d avg/day, 30d, 30d %, 30d avg/day, Total, %.
   - Popover already scrolls horizontally on narrow widths; keep headers `whitespace-nowrap` so nothing wraps.

3. **Verify**
   - Typecheck and build.
   - Open the homepage popover in the running preview, confirm the three new columns render with sensible values (24h avg equals the 24h amount, 7d avg equals roughly a seventh of the 7d amount) and the partial-coverage notice still behaves.

## Technical details
Averages are pure presentation math derived from the already-computed `amount24h`/`amount7d`/`amount30d`, so no history reader, caching or provider behaviour changes. Where a period amount is zero the average renders as zero rather than blank, matching the existing amount cells.
