# Fix missing RAM price samples (Aug 31)

## What the evidence shows

- The data branch `ram-price-data` currently holds exactly 2 samples: Aug 30 02:38 UTC and Aug 30 08:42 UTC (confirmed by reading the raw JSON file).
- The Actions screenshot shows 4 green runs: 2 manual on Aug 30, and 2 scheduled runs listed as "Today" at 2:45 AM and 4:05 AM.
- So today's two scheduled runs finished successfully but committed nothing. A green run with no commit can only mean one thing in the current workflow: the sampler hit its "last sample is under 10h old" guard and exited early, so the JSON file never changed and the commit step logged "No change to commit."

Why the guard fired: the guard measures elapsed time since the *last recorded sample*, not since the last scheduled slot. The two manual runs on Aug 30 moved the anchor to 08:42 UTC, and GitHub's cron queue delivered the following ticks late. Each delayed tick landed less than 10h after that anchor, so both were treated as duplicate catch-up ticks and skipped. Any manual run, or any pair of delayed ticks, can knock the series out of sync the same way and cause a whole day to go unrecorded.

## The fix: slot-based deduplication

Replace the "10h since last sample" rule with "one sample per daily slot":

- Define two slots per UTC day: the 00:00 slot (covers 00:00-11:59 UTC) and the 12:00 slot (covers 12:00-23:59 UTC).
- On each run, compute the current slot. If the history already contains a sample inside that slot, skip. Otherwise record.
- Keep `FORCE=1` on `workflow_dispatch` as an override that bypasses the slot check.

Effects:
- A tick delayed by hours still records, as long as it lands in a slot with no sample yet.
- Manual runs no longer suppress the next scheduled sample — they only fill the slot they run in.
- Duplicate/catch-up ticks in an already-filled slot remain no-ops, so the series stays at two points per day.

## Also in this change

- Add catch-up ticks later in each slot so a badly delayed queue still has chances to land: crons at 00:23, 02:23, 05:23 and 12:23, 14:23, 17:23 UTC. Harmless because of the slot check.
- Log the resolved slot and the decision (recorded / already filled) in the run output, so a future "why is there no sample" question is answerable from the run log alone.
- Update `scripts/ram-price-history/README.md` to document the slot rule instead of the 10h gap rule.
- Backfill: after merging, trigger the workflow manually once with `force = 1` so today (Aug 31) gets a point immediately instead of waiting for the next slot.

## Files touched

- `scripts/ram-price-history/sample.ts` — swap `MIN_GAP_MS` guard for slot computation and slot-occupancy check; add decision logging.
- `.github/workflows/ram-price-history.yml` — add the third catch-up tick per slot; comments updated.
- `scripts/ram-price-history/README.md` — document the new rule.

No frontend changes: `src/hooks/useRamPriceHistory.ts` and `src/components/ram/RamPricePanel.tsx` already render whatever the data branch contains, and the "recorded twice daily" wording stays accurate.
