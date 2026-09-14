# Fix CHEESEAnal volume chart line not connecting

## Problem
The pool-history **Volume (24h)** chart shows two isolated dots instead of a line. This happens because the chart receives the full daily series, but volume is only recorded on the first snapshot of each UTC day; the later snapshot has `volumeUsd: null`. With `connectNulls={false}`, Recharts treats those null entries as breaks, so the valid points are not joined.

## Fix

- In `src/components/anal/AnalPoolDetail.tsx`, render the volume `LineChart` with a filtered dataset that contains only rows where `volumeUsd !== null`. Keep the existing `connectNulls={false}` behaviour so genuine gaps (e.g., days with no recorded volume) remain honest.
- The value box above the chart already uses `volumeSeries[volumeSeries.length - 1]`, so it stays accurate.
- No data-model or sampler changes are needed.

## Verification

- Open `/anal`, select an Alcor pool with at least two recorded volume days, and confirm the volume chart draws a line between the points instead of two separate dots.
- Check that Taco/Defibox pools still show the "Volume is not published by this exchange" message.
- Run TypeScript typecheck and confirm the production build is clean.
