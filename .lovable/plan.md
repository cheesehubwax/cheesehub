# Add pair volume tracking to CHEESEAnal pool history

Add a sixth mini graph to the pool history section showing trading volume for the selected pair, with two lines: volume in USD and volume in CHEESE.

## What gets recorded

- Volume comes from Alcor's published 24-hour figures for each CHEESE pair. Taco and Defibox do not publish volume, so their pools show no volume line for now (the other five graphs are unaffected).
- Volume is recorded **once per 24-hour period** only, on the first snapshot of each UTC day. The later snapshot of the day carries no volume value, so there is no overlap or double counting.
- Because recording starts with the next daily run, the volume graph begins on 13 September while the other graphs keep their 12 September history. Days without a recorded volume are simply left out of the volume line instead of showing as zero.

## What the user sees

- Pool history gains a sixth small chart, "Volume (24h)", placed after the existing five, with a compact value box above it like the others: the latest USD volume, with the CHEESE volume shown as the second line.
- Two lines in the chart: USD volume and CHEESE volume, each on its own axis so both stay readable, using distinct colours consistent with the existing palette.
- Taco/Defibox pools show "Volume not published by this exchange" in place of the chart.
- On day one the chart shows a single visible point, matching how the other charts behaved at launch.
- CSV export for a pool day gains `volume_usd` and `volume_cheese` columns.

## Technical notes

- `src/lib/lpPools.ts`: add optional `volumeUsd24` and `volumeCheese24` to `LpPoolSnapshot` and `LpIndexPool`; carry them through `indexEntryForDay`. Fields stay optional so existing stored days remain valid.
- `src/lib/lpLive.ts`: read `volumeUSD24` and the CHEESE-side `volumeA24`/`volumeB24` from the Alcor `/swap/pools` payload, summing across the fee tiers of a pair; attach to the Alcor pool snapshot only.
- `scripts/lp-history/sample.ts`: include volume only when the run is the first snapshot of its UTC day (no prior stored snapshot for that day, or `RESET`/first-of-day); otherwise omit the fields. Keep existing retry/throttle behaviour.
- `src/components/anal/AnalPoolDetail.tsx`: add the sixth chart with a dual-line `LineChart` (`connectNulls={false}`, skipping days without volume), 70px Y-axis width for grid alignment, and its own compact `w-fit` value box.
- `src/lib/lpCsv.ts`: add the two new columns.
- Tests: extend `src/test/lpPools.test.ts` for volume aggregation and for days missing volume; keep legacy fixtures passing.
