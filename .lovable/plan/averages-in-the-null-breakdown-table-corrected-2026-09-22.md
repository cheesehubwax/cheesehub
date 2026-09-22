# Averages in the Null Breakdown table — corrected

You're right, and my earlier version was wrong. There is only one **Total** per contract. The three averages all come from that single Total, divided by how long that contract has been nulling.

## The rule

For each contract, find the date of its **earliest recorded null**, count the days from then to today (D), then:

- 24h avg = Total ÷ D days
- 7d avg  = Total ÷ (D ÷ 7) weeks
- 30d avg = Total ÷ (D ÷ 30) months

Worked example — a contract first recorded 60 days ago, Total = 6,000 CHEESE:

- 24h avg = 6,000 ÷ 60 = 100 CHEESE per day
- 7d avg  = 6,000 ÷ (60/7 = 8.57) = 700 CHEESE per week
- 30d avg = 6,000 ÷ (60/30 = 2) = 3,000 CHEESE per month

A contract tracked for years divides by its full span, so its averages settle down. A contract first seen 2 days ago divides by 2 days, 0.29 weeks and 0.07 months.

Guard rails: a span shorter than one day counts as one day (no divide-by-zero, no absurd numbers), and a contract with no recorded nulls shows a dash.

## What changes on screen

Three new columns, each placed next to the period it belongs to:

Contract, 24h, 24h %, **avg/day**, 7d, 7d %, **avg/week**, 30d, 30d %, **avg/month**, Total, %

Same yellow CHEESE styling, right-aligned, slightly muted so they read as derived figures. The popover keeps growing only sideways to fit, and every cell stays on one line, as it does now.

## Technical notes

- `src/lib/cheeseNullBreakdown.ts`: while summing transfers per contract, also track `firstSeen` (earliest transfer timestamp). Derive `trackedDays = max(1, (now - firstSeen) / 86_400_000)`.
- Averages computed from the entry's **lifetime amount**, not the period amounts: `avg24h = amount / trackedDays`, `avg7d = amount / (trackedDays / 7)`, `avg30d = amount / (trackedDays / 30)`. All three are the same rate expressed per day, per week, per month — so `avg7d = avg24h * 7` and `avg30d = avg24h * 30` by construction.
- `firstSeen` is unavailable for contracts whose lifetime figure comes from an on-chain stats row rather than transfer history (`cheeseburner`'s `total_cheese_burned`, `cheesepowerz`'s power total). For those, use the earliest transfer timestamp we did observe in the history sweep; if the sweep returned nothing for that contract, leave the averages as a dash rather than inventing a span.
- `NullBreakdownEntry` gains `avg24h`, `avg7d`, `avg30d` (all `number | null`) and `trackedDays`.
- `src/components/home/TokenStatsBanner.tsx`: render the three columns in the order above, `formatFullNumber`, `whitespace-nowrap`, dash when null.
- Tests in `src/test/` covering: 60-day span example, sub-day span clamped to one day, missing history → null averages, and the `avg7d = avg24h * 7` relationship.
