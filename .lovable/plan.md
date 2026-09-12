# Why the graph says $15,347 and the box says $17k

Your reading is right, and the cause is confirmed.

- The recorded snapshot for today (12 Sep) holds only **11 pools totalling $15,357.62** — Alcor 8, Taco 1, Defibox 1 (plus small extras).
- The live figures in the boxes read **18 pools** right now, including the small tracked pairs (CHEESE/HOLE on Alcor, four more Taco pools, two more Defibox pools) that the recorded day is missing.
- GitHub's latest commit is still **"Enforced $100 floor globally"**. Your rollback exists here but has **not reached GitHub yet**, so the workflow that recorded today's day ran the old rule that dropped every pool under $100 — including tracked pairs that should always be kept.

So nothing is wrong with the page or the maths: the stored day was written by the pre-rollback code.

## Fix

1. Push the rollback to GitHub (a small change committed from here re-syncs the repo; the rolled-back files then land on the default branch).
2. Confirm on GitHub that the newest commit is the revert, and that the pool selection keeps every tracked pair regardless of size.
3. Re-run the snapshot: Actions → CHEESEAnal LP History → Run workflow with **`force` = 1**. That overwrites today's stored day with the full pool set instead of appending a second one.
4. Re-check `/anal`: the graph's newest point should land within normal drift of the boxes (about $17.7k, 18 pools), and All / Alcor / Taco / Defibox counts should read 18 / 10 / 5 / 3.

Use `reset` = 1 instead of `force` only if you would rather wipe all stored days and start the series clean — with a single day recorded so far, either is fine.

## Technical detail

- Current selection in `src/lib/lpPools.ts`: `selectVenuePairs` keeps **all** tracked pairs and adds untracked pairs only above `MIN_TRACKED_POOL_USD` ($100), capped by `MAX_EXTRA_PAIRS_PER_VENUE`. This is the behaviour you rolled back to and is what a local sampler run produces (18 pools: Alcor 10, Taco 5, Defibox 3).
- The stored day at `lp-history-data/data/lp-history-index.json` shows `partial: none`, so no venue failed — the gap is purely the pair filter.
- No code change is needed for this fix; it is a sync plus one workflow re-run. If the sync does not carry the revert, the alternative is to re-apply the rollback as a fresh commit touching `src/lib/lpPools.ts` and `src/lib/lpVenues.ts`.
