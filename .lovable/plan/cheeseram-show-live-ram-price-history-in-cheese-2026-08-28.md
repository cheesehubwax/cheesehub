# CHEESERam: show live RAM price history in $CHEESE

Yes, this is possible. The chart currently plots WAX per KB straight from the on-chain `eosio::rammarket` table. We convert each sampled point into CHEESE per KB using the live Alcor CHEESE/WAX market price, and plot that instead.

## What changes for the user

- The "Live RAM Price" panel headline reads e.g. `12.3456 CHEESE / KB` instead of WAX / KB.
- The sparkline and its tooltip both show CHEESE / KB.
- Price is the raw converted price — no buy spread or network fee applied.
- The line now moves when either the WAX RAM price or the CHEESE/WAX market price moves, so it updates more often than before.
- Still session-only history (last 20 samples, refreshed every 30s); it resets on page reload.
- If the CHEESE market price is briefly unavailable, the panel keeps showing "Building price history..." rather than a wrong number.

## Technical notes

- Rate source: `useCheesePriceData()` (`src/hooks/useCheesePriceData.ts`) exposes `waxPrice` = WAX per 1 CHEESE, derived from the shared Alcor swap-tokens query. No new network calls are added.
- Conversion: `cheesePerKb = (ramWaxPerByte * 1024) / waxPerCheese`.
- `src/hooks/useCheeseRam.ts` → `useRamPrice()`: keep sampling `fetchRamPricePerByte()`, and additionally record the CHEESE-denominated value on each sample. `RamPricePoint` gains a `cheesePerKb` field (kept alongside the existing `price` in WAX/byte so nothing else that reads it breaks). A new sample is appended when either the WAX price or the derived CHEESE price changes.
- `src/components/ram/RamPricePanel.tsx`: plot `cheesePerKb`, relabel the headline and tooltip to `CHEESE / KB`, and format to 4 decimals (CHEESE precision) instead of 8.
- `src/pages/Ram.tsx`: unchanged wiring; it already passes `pricePerByte` and `history` through. Buy/Sell cards keep using `pricePerByte` (WAX/byte) for their estimates, which is what the contract math needs.
