# Fix the 24-hour column in Null by Contract

## What I checked

I pulled the same on-chain history the table uses. In the last 24 hours the real nulls are:

- Liquidity Fees 336.0434
- cheesepowerz 17.16
- cheeseburner 13.5513
- ram.chz 8.0

Two separate faults make the 24h (and 7d/30d) figures wrong, while lifetime stays right because lifetime comes from authoritative on-chain counters.

## Fault 1: cheesepowerz is counted twice

The table adds up two histories: CHEESE sent to the null account, and CHEESE sent *into* cheesepowerz. cheesepowerz appears in both, so its 24h figure becomes its own nulls (17.16) plus the deposits it received (30.16) = 47.32. Deposits are also not nulls yet, so they don't belong in a "nulled in the last 24h" number at all.

Fix: for period figures, count only what each contract actually sent to the null account. Keep the incoming-deposit history solely as a lifetime fallback for cheesepowerz when its authoritative counter is unavailable, never in the 24h/7d/30d sums.

## Fault 2: timestamps are read in the viewer's local timezone

The history records timestamps like `2026-09-11T21:44:52.000` with no timezone marker. Read as-is, the browser treats them as local time, so for a viewer at UTC+10 every event is shifted ten hours. Events near the window edge then fall in or out of the 24h/7d/30d buckets incorrectly.

Fix: treat these timestamps as UTC when no offset is present, so window cutoffs are correct for every viewer.

## Verification

After the change the 24h column should read: Liquidity Fees 336.04, cheesepowerz 17.16, cheeseburner 13.55, ram.chz 8.00, others 0 — with the percentages recomputed from those, and lifetime totals unchanged. I will confirm in the running preview and check the build.

## Technical details

- `src/lib/cheeseNullBreakdown.ts`
  - Add a UTC-safe timestamp parser: if the value has no `Z`/offset, append `Z` before `Date.parse`.
  - Restrict period accumulation (`day`/`week`/`month`) to the `transfer.to=eosio.null` union, grouped by `data.from`.
  - Use the `transfer.to=cheesepowerz` union only to derive a lifetime fallback total for `cheesepowerz`; stop feeding it into `addActions` period buckets.
- No other files, no contract/transaction changes; read-only data path only.
