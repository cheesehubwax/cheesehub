# CHEESERam — /ram dApp (frontend)

Add a new CHEESERam page at `/ram`, styled exactly like the existing CHEESEUp / CHEESENull pages. No header link and no homepage tile yet — reachable only by typing `/ram` while you build it out.

Target contract: **ram.chz** (live, already has config, stats and real buys/sells). The account name lives in a single constant so it can be swapped later.

## What the page shows

Hero (same layout as CHEESEUp):
- Floating orb using your uploaded robotic cheese wedge image, clickable for the fart sound.
- Heading: OpenMoji icon + "CHEESE" (yellow) + "Ram" + BETA badge + icon.
- Subtitle explaining: buy WAX RAM with $CHEESE — the CHEESE spent is nulled and leaves circulation forever.

Buy RAM card:
- Connect-wallet state handled like CHEESEUp.
- CHEESE amount input (with Max from wallet balance), respecting the on-chain `min_cheese` / `max_cheese` limits (currently 1–100 CHEESE).
- Optional recipient field, defaulting to your own account (the contract reads the recipient from the transfer memo; empty memo means self).
- Live estimate of bytes received, derived from the on-chain reference rate, the buy spread, and the current `eosio::rammarket` byte price.
- Terms of Use checkbox gate before the transaction, matching other sensitive forms.
- Executes a `cheeseburger::transfer` of CHEESE to the contract with the recipient in the memo, via Greymass Fuel, then shows the success dialog with the verified TX ID.

Sell RAM card:
- Shows your available (unused) RAM bytes.
- Bytes input with Max, bounded by `min_sell_bytes` / `max_sell_bytes` (currently 1 KB – 10 MB).
- Estimated CHEESE payout using the sell spread and haircut, plus a warning when the contract's CHEESE pool or liquid WAX reserve is too low to service the sale.
- Terms checkbox, then an `eosio::ramtransfer` of the bytes to the contract with memo `CHEESERam sell`.
- Disabled with a clear message when `sell_enabled` is false.

Live RAM price panel:
- Current WAX price per KB plus a small session-only sparkline, reusing the pattern already in the CHEESEWallet RAM manager.

Stats bar (bottom, same visual style as the CHEESEUp stats bar):
- Total purchases, total bytes bought, total CHEESE received, total CHEESE nulled, total sales, total bytes sold back, total CHEESE paid out, and the contract's liquid/staked WAX reserve.
- Footer line crediting the CHEESERAM smart contract with a waxblock.io link.

## Technical notes

- New files: `src/pages/Ram.tsx`, `src/components/ram/BuyRamCard.tsx`, `src/components/ram/SellRamCard.tsx`, `src/components/ram/RamPricePanel.tsx`, `src/components/ram/RamStatsBar.tsx`, `src/lib/cheeseRam.ts` (account constant, table readers, byte/CHEESE estimate maths), `src/hooks/useCheeseRamConfig.ts`, `src/hooks/useCheeseRamStats.ts`, `src/hooks/useRamPrice.ts`.
- Asset: the uploaded image is added as the CHEESERam orb graphic in `src/assets`.
- Route `/ram` added to `src/App.tsx` above the catch-all. Header, footer nav and homepage tiles untouched.
- All chain reads go through the existing multi-endpoint fallback helper and react-query caching; tables read: `ram.chz` `config`, `stats`, plus `eosio` `rammarket` and the user's `get_account` for available RAM.
- Estimates are display-only; the contract remains authoritative. Amounts use 4-decimal CHEESE and 8-decimal WAX formatting, and byte values are shown with the shared `formatBytes` helper.
- Transactions use `getTransactPlugins` (Greymass Fuel) and the shared transaction-success dialog with TX ID verification, consistent with the rest of CheeseHub.
- Colors/typography use existing cheese design tokens only — no hardcoded color classes.
