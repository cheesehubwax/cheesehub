# Fix the "in range" count on CHEESEAnal

## What the data shows

Confirmed by reading the recorded snapshots and the live Alcor pool:

- The newest snapshot (19 Sep 12:00 UTC) records m23qs.wam's CHEESE / WAXCASH position as `1 position, 0 in range`.
- Two earlier snapshots (15 Sep and 16 Sep) record it as in range, and on those same snapshots the position held WAXCASH.
- The in-range count is copied straight from Alcor's own `inRange` flag on each position. CHEESEAnal never checks it against the pool's actual price.
- Both places that show the count (the account panel table and the pool detail providers table) read the same recorded value, so they can only ever agree — which matches "both".

So the number on the page is whatever Alcor said at snapshot time, with no independent check. Because you have since removed and re-added the position, the page can also be showing a count for a position that no longer exists in that form.

## Changes

1. Record the range facts in each snapshot, not just a flag: every Alcor position's lower and upper tick, and the pool's tick at snapshot time.
2. Work out in-range ourselves from those recorded ticks (price inside the position's own range), and use that as the authoritative count. Alcor's own flag is kept only as a fallback when the ticks are missing from a snapshot.
3. Add a second, independent sanity check: a position holding only one of the two tokens cannot be in range, so it never counts as in range even if the flag says otherwise. A position holding both tokens is in range.
4. Where the two disagree, trust the ticks/balances and flag the pool as having disagreeing data so it is visible rather than silent.
5. Show the range facts where they help: in the account panel and providers tables, the in-range count gets a hover detail listing each position's price range and the pool price at that snapshot.
6. Older snapshots keep working unchanged — they simply fall back to the recorded flag, since they contain no ticks.

## Validation

- Re-read the newest snapshot after the change and confirm m23qs.wam's CHEESE / WAXCASH row still reads 0 in range.
- Confirm the 15/16 Sep snapshots, where the position held both tokens, remain in range under the new rule (the tokens prove the price was inside the range then).
- Confirm your six currently open CHEESE positions (WAX, WAXUSDC, LSWAX, WAXWBTC, LSW, HOLE) all read as in range, since each holds both tokens and is full-range.
- Run the snapshot sampler once locally against live Alcor data and check the recorded ticks against the pool price.
- Tests for the new rule (both tokens, one token, missing ticks, flag disagreement), typecheck, build, and a look at /anal in the browser.

## Technical notes

- `RawPosition` gains `tickLower` / `tickUpper`; `RawPool` already exposes `tick`.
- `LpProviderRow` gains an optional per-position range list; `LpPoolSnapshot` gains the pool tick. Both optional so existing day files parse.
- `buildPoolSnapshot` in `src/lib/lpPools.ts` replaces `row.inRange === true` with a resolver: ticks first, token balances second, Alcor flag last.
- Constant-product venues (Taco, Defibox) are unaffected — they are always full range.
