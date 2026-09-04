# CHEESEAir: airdrop to Alcor liquidity providers

Add a third snapshot source in box 2 ("Airdrop to holders of") so a drop can target liquidity providers of an Alcor pair (e.g. CHEESE/WAX) instead of token holders or NFT owners. The rest of CHEESEAir — distribution modes, token/NFT/RAM send modes, cost summary, batching, terms gate, confirmation dialog — works unchanged on top of the new list.

## What the user sees

Box 2 gets a third tab: `Token` · `NFT collection` · `Alcor LP`.

In the Alcor LP tab:
- A searchable pair picker (type "cheese", pick `CHEESE / WAX`), listing pairs that have at least one pool with liquidity. A raw pool-pair entry by contract+symbol stays possible via the same search box.
- "Load holder list" then fetches every pool of that pair (all fee tiers), collects the positions, and produces one row per account.
- The holders list shows accounts ranked by weight, with the balance column showing the LP's position value in USD (e.g. `$1,871.72`) and a note of how many pools/positions were merged.
- Header note under the button: number of LPs, number of pools scanned, and the snapshot timestamp — same style as the token/NFT modes.

## Rules confirmed

- Weight = deposited USD value of the position (Alcor's `depositedUSDTotal`), summed per account across all of the pair's fee tiers. This drives pro-rata distribution; equal/fixed distributions ignore weight as they do today.
- Pair-level scope: all fee tiers of the chosen pair are aggregated into one list.
- Only positions that are open and currently in range count. Closed positions, zero-liquidity dust, and out-of-range positions are excluded.
- Accounts with zero USD weight after aggregation are dropped (they cannot receive a pro-rata share and only inflate the count).
- Default deselection keeps the existing behaviour: the sender, the send contract, and system accounts are unchecked on load.

## Technical notes

- New module `src/lib/airdropAlcorLp.ts`:
  - `searchAlcorPairs(query)` — reads `GET https://wax.alcor.exchange/api/v2/swap/pools` (already used elsewhere in the app), groups by unordered token pair (`symbol-contract` keys), and returns pairs with pool ids, fee tiers and total TVL for ranking search results. Cached in-memory for a few minutes.
  - `getAlcorLpHolders(pairKey)` — for each pool id of the pair, `GET /api/v2/swap/pools/{id}/positions`, keep rows where `closed === false && inRange === true && liquidity > 0`, then aggregate `depositedUSDTotal` per `owner`. Returns the existing snapshot shape (`{ holders: [{account, weight, raw}], source, hasBalances: true, truncated }`) so downstream code needs no changes. `raw` carries the formatted USD string used by the holders table.
  - 429 handling routes through `markAlcorRateLimited()` from `src/lib/alcorRouter.ts`, consistent with the other Alcor callers. If the positions endpoint fails for every pool, the snapshot surfaces the existing `snapshotError` message; there is no chain fallback because the on-chain `swap.alcor::positions` table is only indexed by position id and owner, not by pool.
- `AirdropContext.tsx`: widen `snapshotMode` to `'token' | 'nft' | 'lp'`, add `snapPair` state plus the pair search results, and branch `loadSnapshot()` to the new fetcher. Exclusion defaults and `sortedHolders` (already sorted by weight descending) stay as-is.
- `AirSnapshotCard.tsx`: third tab with a combobox for the pair search (shadcn `Command` inside `Popover`, matching the swap token selector pattern), showing pair symbols and fee tiers found.
- `AirHoldersTable.tsx`: when `snapshotMode === 'lp'`, the balance column header reads `LP value (USD)` and the cell renders the aggregated USD figure; the "Receives"/"Spends" column is untouched.
- New query hook in `src/hooks/useAirdropQueries.ts` for the cached pair list.
- No smart-contract, signing, or send-mode changes.

## Verification

- `bunx tsgo --noEmit` and a production build.
- Load `/air`, choose Alcor LP → CHEESE/WAX, confirm the list populates ranked by USD value, that pro-rata splits distribute against those weights, and that the cost summary/recipient counts update as with token snapshots.
