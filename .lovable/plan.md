# CHEESEFolio: read full history so holdings stop showing "history incomplete"

## What was found
- liquidcheese was created on 2024-12-27.
- The services the scan used only go back part of the way: EOSUSA to 2026-02-19, Alcor to 2026-08-11. About 14 months of trades were missing, so no token's history matched its real balance and every holding was marked "history incomplete". The profit/loss figures were wrong for the same reason.
- `wax.eosdac.io` (used by collection-manager and already in our shared node list) has the full history: its first transfer is 2024-12-28, it has more than 10,000 transfers, it allows browser requests, and it answers in about 2 seconds.
- The scan picked the three *fastest* services, so EOSDAC was left out even though it is the only one with the full record.

## What changes
1. **Pick services by how far back they go, not just speed.** The quick check before each scan records the oldest transfer each service has. A full-history service is always included; fast partial ones are still used alongside it to fill any holes.
2. **EOSDAC is always on the candidate list** for CHEESEFolio, along with the existing ones.
3. **Coverage check.** Compare the oldest transfer found with the account's creation date. If no working service reaches back to the start, show a clear note such as "History available from Feb 2026, account created Dec 2024 — profit/loss for older holdings can't be checked yet", instead of quietly showing wrong numbers.
4. **Fix already-saved scans.** Pressing **Sync now** on an account scanned with partial history (like liquidcheese) reads the full history from EOSDAC and merges it in. No rescan from scratch, and duplicates are removed automatically.
5. **Heavier first scans.** liquidcheese has over 10,000 transfers, so expect roughly 30–60 seconds, with progress shown. Stop and Continue still work.
6. **Check it against your balances.** After the change, scan liquidcheese and compare each holding's history total with the live balance. Any token that still doesn't match gets investigated before this is called done.

## Technical details
- `src/lib/folio/scanner.ts`: `probeProviders` returns `{ base, ms, earliestTs }` from the `limit=1, sort=asc` probe. Choose the provider with the smallest `earliestTs`, plus up to 2 more by speed. Add `https://wax.eosdac.io` to `FOLIO_HYPERION_EXTRA`. Store each provider's earliest timestamp on the record (`coverageFrom`).
- Coverage: read the account's `created` value from chain `get_account` (through the existing RPC fallback). Expose `coverageFrom` and `accountCreated` from `useFolio`. In `Folio.tsx`, show the gap note when coverage starts more than a day after creation.
- Existing per-provider cursors stay as they are; a newly chosen provider starts with an empty cursor, and the union de-duplicates by `global_sequence`.
- Tests: provider selection (the full-history provider wins over faster partial ones) and the coverage-gap rule.
- Then run a real scan of liquidcheese and compare per-token history totals with live balances.
