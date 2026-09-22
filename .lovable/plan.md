# Add average columns to Null by Contract

## Goal
Add three average columns to the Null Breakdown table: one after each of the 24h, 7d and 30d periods, for every contract.

## How each average is calculated
We know how far back each contract has actually been tracked (the timestamp of its oldest history record). Each average divides the column's amount by the real tracked span inside that period, so a contract with only partial history is not unfairly diluted:

- **24h avg/day** = 24h amount ÷ tracked days (capped at 1 day).
- **7d avg/week** = 7d amount ÷ tracked weeks (capped at 1 week).
- **30d avg/month** = 30d amount ÷ tracked months (capped at 1 month).

"Tracked" means: from the contract's oldest record within that period up to now, never longer than the period itself. A contract whose history covers the full period divides by the full 1 day / 1 week / 1 month; a contract that only started nulling halfway through divides by half, giving its true average rate over the time it has actually been active. If a contract has no records in a period, the average is zero.

## Changes
1. **Breakdown data** (`src/lib/cheeseNullBreakdown.ts`)
   - While grouping history, record each contract's earliest timestamp (overall and within the 7d/30d windows).
   - Add `avg24h`, `avg7d`, `avg30d` to `NullBreakdownEntry`, computed as above.
   - No new chain reads — everything derives from the history already fetched.

2. **Table** (`src/components/home/TokenStatsBanner.tsx`)
   - New columns right after each period's `%` column: `24h avg/day`, `7d avg/wk`, `30d avg/mo`.
   - Final order: Contract, 24h, 24h %, 24h avg/day, 7d, 7d %, 7d avg/wk, 30d, 30d %, 30d avg/mo, Total, %.
   - Same `formatFullNumber` + yellow CHEESE styling as the amount cells, right-aligned; popover already handles the extra width with horizontal scroll on small screens.

3. **Verify**
   - Typecheck and build.
   - Open the homepage popover in the running preview: confirm the three columns render, a fully-tracked contract's 24h avg equals its 24h amount, and a recently-started contract shows a higher average than naive division would give.

## Technical details
Pure read-side math on records already retrieved — no new provider calls, caching or transaction behaviour changes. Earliest-timestamp tracking piggybacks on the existing `addActions` loop; contracts relying on authoritative on-chain counters (cheeseburner, cheesepowerz) still use history-derived earliest timestamps for their spans, with the full window as fallback when no history rows exist.
