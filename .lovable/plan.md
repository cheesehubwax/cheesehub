# CHEESEAir — airdrop RAM with $CHEESE

Add **RAM** as a third "What to send" mode in CHEESEAir, next to Token and NFTs. Every recipient is bought RAM directly into their own account by sending `$CHEESE` to `ram.chz` with their name in the memo — the same mechanism CHEESERam's Buy card already uses for buying RAM for someone else. No contract changes.

## How it works for the user

1. **Step 1 — What to send:** a new "RAM" tab. It shows your CHEESE balance, the live CHEESE/KB price, and the contract's per-purchase minimum and maximum in both CHEESE and KB.
2. **Step 2 — Snapshot:** unchanged. Token holders, or AtomicAssets collection / schema / template holders.
3. **Step 3 — Distribution:** all three modes work.
   - **Fixed each** — a set amount per recipient.
   - **Equal split** — a total CHEESE budget divided evenly.
   - **Pro-rata** — by holding weight.
   Amount entry is switchable between **CHEESE each/total** and **KB each/total**: with KB selected the amount is converted to the CHEESE needed at the live price plus a small buffer so price drift between batches doesn't shortchange anyone.
4. **Contract limits are enforced per recipient.** Any recipient whose computed amount falls below the contract minimum (or above the maximum) is listed and excluded before you run, with a clear count — "12 of 300 recipients fall below the 10 CHEESE minimum and will be skipped." Fixed-each is blocked outright if the amount itself is out of range.
5. **Costs panel** shows total CHEESE spent, RAM delivered in KB, transaction count, and estimated CPU/NET. RAM mode needs **no RAM purchase for the sender** — the RAM row belongs to each recipient — so the "buy RAM" step is hidden and only the CPU/NET top-up remains. It also notes that the CHEESE spent is nulled.
6. **Run** batches the transfers exactly like the token path: sequential transactions, a live per-batch log with WAXBlock links, cancel-after-current-batch, and the CSV download (recipient, CHEESE, KB).

## Important caveats surfaced in the UI

- RAM bought for someone else cannot be reclaimed by you — it becomes theirs and only they can sell it.
- CHEESE spent on RAM is nulled, exactly as in CHEESERam.
- Each recipient is a separate purchase, so each must clear the contract minimum; batch size defaults lower for RAM because a RAM purchase costs more CPU than a plain token transfer.

## Technical notes

- **Send mode:** `assetKind` in `src/components/air/AirdropContext.tsx` widens from `'token' | 'nft'` to include `'ram'`, with an `isRam` flag alongside `isNft`. Existing token/NFT branches stay untouched; RAM takes its own branch wherever `isNft` currently forks (amount computation, estimate, warnings, action building, CSV).
- **Amounts:** RAM reuses `computeAmounts` from `src/lib/airdrop.ts` at CHEESE precision 4 (so largest-remainder rounding still makes totals exact), then a new pure helper filters recipients against `minCheese`/`maxCheese` from the `ram.chz` config and reports the excluded set. KB↔CHEESE conversion uses the existing `useRamPrice` / `estimateCheeseForBytes` / `resolveQuoteRate` helpers from `src/lib/cheeseRam.ts` — no new pricing math.
- **Actions:** one `cheese token::transfer` per recipient — `{ from: actor, to: CHEESE_RAM_CONTRACT, quantity: "<n>.0000 CHEESE", memo: recipient }` — batched by the existing batching and signing path (`WaxContext` session transact with Greymass Fuel, 1.2s spacing, per-batch error capture, stop-on-failure preserving the log).
- **Estimates:** a `estimateRamAirdropResources` variant in `src/lib/airdrop.ts` with a higher CPU-per-action figure for a RAM purchase and `maxNewRows: 0` for the sender, so the RAM-purchase prerequisite drops out of `AirCostPanel`.
- **UI:** `AirSendCard` gains the RAM tab and its balance/price/limits readout; `AirDistributionCard` gains the CHEESE/KB unit toggle and the skipped-recipient notice; `AirCostPanel` gains the RAM columns and hides the sender RAM purchase; `AirRunPanel` labels the log "RAM purchased". The optional Sell RAM card stays as-is (it is about your own leftover RAM).
- **Guards:** insufficient CHEESE balance, `buyEnabled` false, contract WAX pool warnings, and the existing mandatory Terms checkbox all gate the run button.
