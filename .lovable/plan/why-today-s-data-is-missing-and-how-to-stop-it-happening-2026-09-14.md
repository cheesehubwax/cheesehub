# Why today's data is missing, and how to stop it happening

## What I checked

Both scheduled jobs on GitHub are switched on and healthy — nothing is broken or disabled:

- CHEESEAnal liquidity: last 8 runs all succeeded. Last recorded snapshot: **13 Sep 13:53 UTC**.
- RAM price: it *did* record today — **14 Sep 05:07 UTC** — just very late, which is likely why the chart looked empty when you looked.

## The actual cause

GitHub runs these scheduled jobs on a shared queue and delays or silently skips them when it is busy. Real evidence from the run list:

- The job set for 21:41 yesterday actually started at 23:28 (nearly 2 hours late).
- Today's two morning attempts (01:41 and 04:41) never started at all, so the morning liquidity snapshot is still missing.
- RAM's 02:23 attempt started at 05:07.

So the schedule is correct; GitHub is unreliable at honouring it. Each 12-hour slot currently gets three attempts, and today all the early ones for liquidity were dropped.

## Fix

1. Add more attempts per 12-hour slot for both jobs (liquidity and RAM price), spread evenly across each slot instead of clustered near its start. With attempts roughly every 90 minutes, a slot only misses if GitHub drops six or seven attempts in a row.
2. Keep the existing behaviour that only the first successful attempt in a slot records anything, so extra attempts stay free no-ops and no duplicate points appear.
3. Add a catch-up rule: if a run notices the *previous* slot was never recorded, it records the current slot as normal and logs the gap clearly, so missed slots are visible rather than silent.
4. Immediate one-off: run the CHEESEAnal LP History job manually (both inputs left at 0) so today's morning snapshot is captured now rather than waiting for the next attempt.

## Technical details

- `.github/workflows/lp-history.yml` and `.github/workflows/ram-price-history.yml`: expand the `schedule` cron list to ~8 ticks per day per workflow, spaced across both UTC slots.
- `scripts/lp-history/sample.ts` and the RAM sampler: keep slot-key guarding (`YYYY-MM-DDTHH`) as the single source of truth for "already recorded"; add a log line when the preceding slot key is absent from the index.
- No frontend change needed — the pages read the recorded files at runtime, so a new snapshot appears without a rebuild.
