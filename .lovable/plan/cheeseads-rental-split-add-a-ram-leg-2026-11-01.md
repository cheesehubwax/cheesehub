# CHEESEAds rental split: add a RAM leg

## Goal
Change how WAX from each banner ad rental is split:

| Destination | Now | New |
|---|---|---|
| cheeseburner | 25% | 10% |
| cheesepowerz | 25% | 20% |
| ram.chz | — | 20% (new) |
| Alcor buyback → CHEESE | 50% | 50% (unchanged) |

The bought-back CHEESE keeps its 66% nulled / 34% xcheeseliqst split.

## Contract change (cheesebannad)
- In `distribute_wax_funds`: burner = 10%, powerz = 20%, new ram = 20%; swap = whatever is left (so rounding dust goes to the buyback and the total always matches the payment exactly).
- Add a `RAMCHZ = "ram.chz"_n` constant next to the other account names, plus an inline WAX transfer with memo "CHEESEAds ecosystem financing", sent only if the amount is above zero.
- No table, ABI-struct or stored-data changes, so the "read past the end" problem cheesepowerz had cannot happen here. `distribute_cheese_funds` is not touched.
- Compile with CDT 4.1.0 in the sandbox, then deliver a zip with the source, prebuilt wasm/abi and step-by-step instructions (waxblock.io deploy plus Windows CMD Docker build).

## Checks before delivery
- Confirm on chain that ram.chz accepts plain WAX transfers with this memo and won't reject them. A rejected transfer would make every ad rental fail.
- Confirm `cheesebannad@active` still includes `eosio.code` (it did last time I checked).
- Work through example sums (e.g. 1.0000 and 0.0007 WAX) to show the four legs always add up to the payment.

## Website change (CHEESEHub)
- `src/lib/bannerAdStats.ts`: also fetch ad-rental transfers to ram.chz, matched by the CHEESEAds memo so other ram.chz income isn't counted.
- Ad stats bar: add a "WAX → ram.chz" figure next to the burner and powerz figures.
- Update the split wording in the help, legal and ad-rental text and in the banner-ad memory note.

## Risks and things to flag
- The new split only applies to rentals paid after you deploy. Older rentals keep the old split.
- If ram.chz ever starts rejecting transfers, ad rentals will fail, so you'd need to redeploy cheesebannad.
- No new legal risk: this is still a fixed, automatic split inside one transaction with no funds held.

## Not included
- No changes to the cheesepowerz or ram.chz contracts.
