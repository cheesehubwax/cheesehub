# Null-breakdown averages: divide by how long each contract has been tracked

## The rule

For each contract, find its earliest recorded nulling action. Count the days from that record to today. Then:

- **24h avg/day** = 24h total ÷ tracked days
- **7d avg/wk** = 7d total ÷ tracked weeks (tracked days ÷ 7)
- **30d avg/mo** = 30d total ÷ tracked months (tracked days ÷ 30)

In one equation, with D = tracked days (D never below 1):

```text
avg24h = 24h total ÷ D
avg7d  =  7d total ÷ (D / 7)
avg30d = 30d total ÷ (D / 30)
```

Worked example — a contract first recorded 60 days ago (D = 60):

- 24h avg = 24h total ÷ 60
- 7d avg = 7d total ÷ (60/7) ≈ 7d total ÷ 8.57 weeks
- 30d avg = 30d total ÷ (60/30) = 30d total ÷ 2 months

So a contract whose first record is 2 days ago shows its 24h total ÷ 2, its 7d total ÷ (2/7), and its 30d total ÷ (2/30). A contract tracked for years divides by the full span.

Guards: a contract with no records yet shows averages of 0; the divisor never goes below 1 day (same-day first record → ÷ 1).

## Changes

### `src/lib/cheeseNullBreakdown.ts`

1. While accumulating each contract's totals in `addActions`, also track the earliest action timestamp per contract (`firstSeen` map alongside `totals`).
2. Replace the current full-period division (`values.day / 1`, etc.) with:
   - `trackedDays = max(1, ceil((now - firstSeen) / DAY_MS))`
   - `avg24h = values.day / trackedDays`
   - `avg7d = values.week / (trackedDays / 7)`
   - `avg30d = values.month / (trackedDays / 30)`
3. Update the field comments on `NullBreakdownEntry` to describe the tracked-span basis.

### Tests (`src/test/cheeseNullBreakdown.test.ts` or the existing breakdown test file)

- A contract with records spread over 10 tracked days: averages equal totals ÷ 10 days / ÷ (10/7) weeks / ÷ (10/30) months.
- A contract first seen today: divisors clamp to 1 day, averages equal the raw totals.
- A contract with no records: averages are 0.

## No UI changes

The three average columns, formatting, popover width behaviour, and column order stay exactly as they are — only the numbers change.

## Verification

- Run the unit tests and typecheck.
- Open the Null Breakdown popover in the preview and confirm ram.chz now shows its 24h total divided by its short tracked span (a large per-day average), while long-tracked contracts like cheeseburner show small per-day averages.
