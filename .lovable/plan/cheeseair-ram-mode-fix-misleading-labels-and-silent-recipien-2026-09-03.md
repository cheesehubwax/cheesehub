# CHEESEAir RAM mode: fix misleading labels and silent recipient drops

## What you saw, and why

Both things you noticed are real, and neither is a chain problem.

1. **"Recipients 5" instead of 50.** In RAM mode every recipient gets their own CHEESE transfer to `ram.chz`, and that contract enforces a per-purchase minimum (currently 1.0000 CHEESE) and maximum (100.0000 CHEESE). Pro-rata splitting 100 CHEESE across the top 50 holders gives most of them far less than 1 CHEESE, so 45 of them are filtered out as impossible purchases. Only the 5 largest holders had a share of 1 CHEESE or more. The summary did mention "45 recipient(s) were skipped", but it is buried in small print under the resource block while the big "Recipients 5" number gives no hint why.

2. **"Receives (WAX)".** The holders table column header always uses the token picked in the token send mode (default `eosio.token` / WAX). In RAM mode nobody receives WAX — the number in that column is the CHEESE spent buying RAM for that account. The header is simply mislabelled.

## Can RAM be batch-bought for multiple accounts?

Not with one memo. `ram.chz` reads a single account name from the transfer memo, so each recipient needs its own `cheese.token::transfer`. It can still be batched at the transaction level, and CHEESEAir already does this: it packs up to `batch size` transfers (default 15) into one signed transaction. So 50 recipients = 50 transfer actions, but only ~4 signatures — not 50.

## Changes

**1. Honest labels in RAM mode**
- Holders table column becomes `Spends (CHEESE)` in RAM mode (and shows the KB it buys in the row tooltip/subtext), instead of `Receives (WAX)`.
- Add a short line above the table in RAM mode: amounts shown are CHEESE spent on RAM for that account.

**2. Make the drops visible, not buried**
- The Recipients metric shows `5 of 50` with a `45 skipped` note directly beneath it in RAM mode.
- Skipped recipients get an explicit warning row in the existing warnings area, split into "below minimum" and "above maximum", each naming the limit.

**3. Help fix an under-funded pro-rata drop**
- When any recipient falls below the contract minimum, show the smallest total that would keep every selected holder in, computed from the smallest selected weight, e.g. "Enter at least 1,240 CHEESE to include all 50 holders, or reduce the selection."
- A one-click "Raise to minimum viable total" button fills that number into the amount field.
- No silent redistribution or auto-bumping to the minimum: what you type is what gets signed.

**4. Batching clarity**
- Under the run panel in RAM mode, state that each recipient needs its own transfer and show the resulting action/transaction counts (e.g. "50 transfers in 4 transactions").

## Technical notes

- `src/components/air/AirdropContext.tsx`: expose the selected-holder count and the minimum viable total for the current mode alongside `ramExcluded`; keep `filterRamRecipients` behaviour unchanged.
- `src/components/air/AirCostPanel.tsx`: recipients metric `included of selected`, skipped sub-line, minimum-viable hint.
- `src/components/air/AirHoldersTable.tsx`: RAM-aware column header and helper text.
- `src/components/air/AirDistributionCard.tsx`: the "raise to minimum viable total" action.
- `src/components/air/AirRunPanel.tsx`: transfers-per-transaction wording.
- No contract changes, no change to how transactions are built or signed.
