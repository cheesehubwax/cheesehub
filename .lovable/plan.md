# Add Defibox and Taco volume to CHEESEAnal

You are right about Defibox — it does publish 24h volume per pool, and the current
"volume is not published by this exchange" message is out of date. Taco is different:
its own site has no volume feed at all, so its volume has to be worked out from the
trades themselves.

## What I checked

- Defibox publishes per-pool 24h volume in the same feed its market page uses. Both
  CHEESE pools are there right now: CHEESE/WAXUSDC ~350 CHEESE traded, and WAX/CHEESE
  ~1,202 WAX traded, along with the WAX-equivalent figure used for a USD value.
- Taco's own pool and analytics pages read nothing but raw blockchain records — no
  volume figure is published anywhere. Its pool records hold reserves only.
- Taco does record every single swap on-chain, so a day's volume can be added up from
  those records. There are over 10,000 Taco swaps a day across all pools, so this is a
  heavier read than Defibox.

## What changes

- Defibox pools get real 24h volume, recorded once per day exactly like Alcor's, so the
  sixth "Volume (24h)" chart appears for them.
- Taco pools get 24h volume added up from the day's recorded swaps for that pool. If
  that read cannot be completed in full, no volume is recorded for that day rather than
  an understated number — the chart simply skips the day.
- The "Volume is not published by this exchange" message is removed. Pools with no
  volume yet show "Volume history starts with the next daily snapshot."
- Total volume in the CHEESE Overview box now covers all three exchanges, so it will
  step up from the day this starts recording. Earlier days keep their Alcor-only totals.
- Volume for Defibox and Taco starts from the next daily run; all other charts keep
  their existing history untouched.

## Technical notes

- `src/lib/lpVenues.ts`: add `fetchDefiboxPairVolume(prices)` reading
  `POST https://wax.defibox.io/api/swap/getMarket`, keyed by pair id; CHEESE-leg volume
  taken directly when `volume_symbol` is CHEESE, otherwise derived from the pair's
  `price`; USD from `volume_wax` × the WAX price already in `UsdPrices` (falling back to
  the payload's `waxUsdtPrice`). Add `fetchTacoPairVolume(pairIds, since)` paging
  Hyperion `swap.taco:exchangelog` back 24h with a bounded page count and deadline,
  summing the CHEESE leg per pair id and throwing rather than returning partial sums.
- `snapshotAmmVenue` gains a `withVolume` flag; when set it attaches
  `volumeUsd24`/`volumeCheese24` to each snapshot, wrapped in try/catch so a volume
  failure never costs the liquidity snapshot.
- `scripts/lp-history/sample.ts`: pass the existing first-snapshot-of-the-UTC-day
  `withVolume` flag through to Taco and Defibox, and log volume per venue.
- `src/lib/lpLive.ts`: same for the live reader (Defibox only, to keep it fast).
- `src/components/anal/AnalPoolDetail.tsx`: drop the venue-specific "not published"
  copy; keep the single USD line and the existing non-null filtering.
- Tests in `src/test/lpPools.test.ts`: Defibox volume mapping for both CHEESE-first and
  CHEESE-second pools, and Taco per-pair summing from sample swap records.
