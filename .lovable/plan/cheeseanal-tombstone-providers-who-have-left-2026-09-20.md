# CHEESEAnal Tombstone — providers who have left

A new section at the very bottom of CHEESEAnal listing accounts that once held
more than $10 of liquidity in a tracked pool but have since pulled out or
dropped to effectively nothing.

## What it shows

- Heading: 🪦 Tombstone, with the same BETA-style framing as the other sections.
- One row per departed account, biggest peak first:
  - Account name (clickable — loads them in the account panel above).
  - Peak value: the highest total value ever recorded for them, and the snapshot
    date it was recorded on.
  - Pools they were in, with the pair and exchange logos already used elsewhere.
  - Last seen: the most recent snapshot where they still held more than dust.
  - Current value, shown as $0.00 or the dust amount left behind.
- A short line above the list explaining the rule in plain words: peaked over
  $10, now gone or worth under $1.
- Empty state: "No providers have left yet." Loading and failure states match the
  rest of the page (no live data is ever substituted).

## Rules

- Looks across **all recorded snapshots** for the open token tab, not just the
  selected range.
- Qualifies when the account's peak total across all pools was above $10 **and**
  their latest recorded total is under $1 (including accounts that no longer
  appear in the newest snapshot at all).
- Respects the venue filter: with a venue selected, only that venue's pools count
  towards peak and current value.
- Snapshot-only, like every other figure on the page.

## Technical notes

- Provider rows only exist in the per-day files (`data/<token>/days/<key>.json`),
  so a new hook `useLpDeparted(dates, token)` in `src/hooks/useLpHistory.ts`
  reuses the existing chunked day fetcher (concurrency 6, 404-tolerant) over the
  full recorded date list from the index, cached by react-query with a long
  stale time and keyed on the token plus date list.
- Aggregation helper in `src/lib/lpPools.ts`: walk snapshots oldest→newest,
  accumulating per account `{ peakUsd, peakDate, lastActiveDate, lastUsd,
  pools: Set<poolKey> }` from each pool's `providers` rows, then filter with the
  peak/current thresholds. Thresholds exported as named constants
  (`TOMBSTONE_PEAK_USD = 10`, `TOMBSTONE_DUST_USD = 1`).
- New component `src/components/anal/AnalTombstone.tsx`, rendered last in
  `src/pages/CheeseAnal.tsx` above the closing footnote, taking the departed
  rows plus `venue`, `token` and an `onSelectAccount` callback.
- Unit tests in `src/test/lpPools.test.ts` covering: a departing account is
  listed with the right peak and last-seen date, an account that never passed
  $10 is excluded, an account still holding value is excluded, dust-only
  leftovers are included, and venue filtering changes who qualifies.
