# CHEESEAir: stop dropping large RAM recipients

## What's happening

The RAM contract (`ram.chz`) accepts at most **100.0000 CHEESE per purchase** (verified from the live contract config: min 1.0000, max 100.0000). With a 300 CHEESE pro-rata drop, your top LP holder's share works out above 100, so CHEESEAir silently removes them from the run. The existing "above the maximum" notice only appears in the Summary box far below, not in the Distribution box where you set the amount, and the holders table just shows a dash with no reason.

## Fix: split a large share into several purchases

Instead of skipping a recipient whose share exceeds the cap, CHEESEAir will send them multiple RAM purchases that add up to their full share — for example 130 CHEESE becomes 100 + 30. The contract credits each purchase to the same account via the memo, so the recipient ends up with all the RAM they were allocated.

Rules:
- Each slice stays within min and max (1 to 100 CHEESE). Slices are sized so no trailing slice falls under the 1 CHEESE minimum.
- Recipients whose *whole* share is under the minimum are still skipped — that limit can't be worked around. The existing "raise to minimum viable total" helper stays.
- The extra slices count as extra actions, so the transaction count and CPU estimate rise accordingly and batching still applies.

## What you'll see

- Holders table: a recipient needing more than one purchase shows their full amount, with a small note such as "2 purchases".
- Summary: "Recipients 15 of 15", the transaction/CPU estimates reflect the extra actions, and a line stating how many holders are being paid over multiple purchases.
- Distribution box (box 3): the over-limit warning now also appears here, next to the amount field, so anything skipped or split is visible where you're typing. Only genuinely skipped (below-minimum) holders are described as skipped.
- Run log: each batch still reports its transaction id; slices for one recipient may land in different batches.

## Technical notes

- `src/lib/airdrop.ts`: replace `filterRamRecipients`' `aboveMax` bucket with a splitter that expands an over-cap recipient into multiple purchase entries (reusing the slice logic already in `splitPurchases` in `airdropResources.ts`). Return per-recipient purchase counts alongside the flat purchase list.
- `src/components/air/AirdropContext.tsx`: derive `ramPurchases` (the flat, batchable list) separately from `recipients` (one row per account) so the summary counts accounts while batching, CPU/NET estimates and the run loop use purchases. `ramExcluded` keeps `belowMin`; `aboveMax` becomes `splitCount` (accounts needing multiple purchases). The RAM run loop chunks `ramPurchases`.
- `src/components/air/AirHoldersTable.tsx`: show the purchase count for split rows.
- `src/components/air/AirCostPanel.tsx` and `AirDistributionCard.tsx`: swap the "above maximum, skipped" copy for the split explanation and surface it in both places.
- Unit-test the splitter for: share under min, share exactly at max, share just over max, and a share whose remainder would fall below min.
