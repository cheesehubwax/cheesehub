# CHEESEAnal — add a HOLE token tab

Add a token switch at the top of CHEESEAnal (CHEESE / HOLE). Everything below it — value boxes, the main graph, the pools table, pool history mini graphs, account detail and CSV exports — works exactly the same way, just for the selected token. All figures stay snapshot-only; no live data.

## What the user sees

- A CHEESE / HOLE switch above the range and venue filters. CHEESE is the default.
- Switching to HOLE shows HOLE's own pools on Alcor, Taco and Defibox: pool value, HOLE in pool, paired token, providers, positions, HOLE price in each pair, and volume where the venue publishes it.
- Every HOLE pair holding more than $100 is recorded automatically, with no fixed list.
- The CHEESE/HOLE pool appears on both tabs — as CHEESE / HOLE under CHEESE priced in HOLE, and as HOLE / CHEESE under HOLE priced in CHEESE.
- Wording, headings and the historical-data note follow the selected token (e.g. "HOLE Overview", "HOLE in pool").
- HOLE graphs start empty and begin building from the first HOLE snapshot; existing CHEESE history is untouched.

## Snapshots

- The twice-daily workflow records a HOLE snapshot alongside the CHEESE one, into its own set of files on the same data branch, so a HOLE failure can never damage CHEESE history.
- Same slot rules as today: first successful run in each 12-hour UTC slot records, later runs are no-ops. The existing force/reset inputs keep working and apply per token.

## Technical scope

- Make the pool model token-agnostic: replace the hard-coded `CHEESE_SYMBOL`/`CHEESE_CONTRACT` constants in `src/lib/lpPools.ts` with a token descriptor (`{ symbol, contract }`), and thread it through `pairFor`, `venuePair`, pool matching, price derivation and aggregation. Keep a `CHEESE_TOKEN` export plus a new `HOLE_TOKEN` (`HOLE` / `hole.cheese`).
- Tracked pairs become per-token: CHEESE keeps its current explicit list; HOLE uses discovery only (every HOLE pool above `MIN_TRACKED_POOL_USD`, capped by `MAX_EXTRA_PAIRS_PER_VENUE` per venue as today).
- `src/lib/lpVenues.ts`: parameterise the Alcor pool scan, Taco `pairs` scan, Defibox `pairs`/market scan, provider/position reads and volume reads by the base token instead of assuming CHEESE.
- `scripts/lp-history/sample.ts`: accept a token argument, write index and day files under a token-scoped path (`data/<token>/lp-history-index.json`, `data/<token>/days/<slot>.json`), keeping the existing CHEESE paths as-is for backwards compatibility. Run both tokens in one workflow invocation, each independently error-guarded.
- `.github/workflows/lp-history.yml`: add the HOLE sampling step and include the new files in the commit.
- `src/hooks/useLpHistory.ts`: take a token parameter, scope query keys and fetch paths per token, and keep the CHEESE paths unchanged.
- `src/pages/CheeseAnal.tsx`: token state + switch, passed into overview, pools table, pool detail and account panel; reset pool/account selection on token change.
- `src/components/anal/*`: token-aware labels and logos (`PairLogos` takes the base token instead of assuming CHEESE), including headings, tooltips, value boxes and `src/lib/lpCsv.ts` export columns.
- Tests: extend `src/test/lpPools.test.ts` and `src/test/lpVenueVolume.test.ts` with HOLE fixtures covering pair discovery, the shared CHEESE/HOLE pool being recorded from both sides, price-in-pair direction, and token-scoped file paths.
- Verify: focused tests, typecheck, a dry sampler run for both tokens, then browser checks of both tabs including the empty HOLE state.
