# Fix CHEESERam quotes to use the live Alcor CHEESE/WAX rate

## What is happening

The Buy/Sell quotes on `/ram` price CHEESE using the rate stored in the contract's
`config` table (`reference_rate`), not the live market rate.

Verified on chain just now:

- `ram.chz` config: `reference_rate = 1.93459804`, `buy_spread_bps = 50`, `max_deviation_pct = 25`, `alcor_market_id = 1252`
- Live Alcor pool 1252 price: `1.97892` WAX per CHEESE
- The quote shown in the screenshot (`1.92492505 WAX` for 1 CHEESE) is exactly
  `1.93459804 x 0.995` — i.e. the stale stored rate minus the 0.5% buy spread

So the number is not a bug in the maths; it is the wrong rate source. The RAM price
chart on the same page already uses the live Alcor rate, which is why the chart and
the quote disagree.

## What to change

1. Quote CHEESE at the live Alcor CHEESE/WAX rate (same source the chart already
   uses), for Buy RAM, the new "Target bytes" mode, and Sell RAM.
2. Keep `reference_rate` as a sanity guard only: if the live rate deviates from the
   stored reference rate by more than the contract's `max_deviation_pct` (25%), fall
   back to the stored rate and show a small warning that the contract's oracle rate
   is stale, since a purchase could otherwise be rejected on chain.
3. Show the rate being used in the quote box, e.g. `Rate: 1 CHEESE = 1.9789 WAX
   (live)`, so any future drift is visible immediately.
4. Keep the existing "estimate only — the contract calculates the final amount at
   execution time" note; spreads, slippage and buffers stay as they are.

## Technical details

- `src/lib/cheeseRam.ts`: give `estimateBytesForCheese`, `estimateCheeseForTargetBytes`
  and `estimateCheeseForBytes` an explicit `waxPerCheese` rate argument instead of
  reading `config.referenceRate` internally. Add a small helper that picks the rate:
  live rate when present and within `max_deviation_pct` of `reference_rate`,
  otherwise `reference_rate` plus a `stale` flag. Parse `max_deviation_pct` in
  `fetchCheeseRamConfig` (currently not read).
- `src/pages/Ram.tsx`: read the live rate once (`useCheesePriceData().data.waxPrice`,
  already used by `useRamPrice`) and pass it to `BuyRamCard` and `SellRamCard`.
- `src/components/ram/BuyRamCard.tsx` / `SellRamCard.tsx`: use the resolved rate for
  the estimate rows and the derived CHEESE amount in "Target bytes" mode, display the
  rate line, and render the stale-oracle warning when the fallback kicks in.

No contract changes and no transaction-logic changes — the transfer action and
memo behaviour stay exactly as they are.
