# CHEESERam — "Fund WAX Pool" manual vote-reward claim

Add a centred box on `/ram`, directly beneath the RAM.CHZ Liquid WAX / Liquid CHEESE values, that lets anyone push the contract's `claimvotes` action so the WAX voting rewards earned by `ram.chz` land in the liquid WAX pool.

## What the user sees

- A single centred card titled **Fund WAX Pool** with:
  - the live claimable amount (WAX) for `ram.chz`, ticking up each second like the CHEESEWallet vote-rewards panel does
  - a short line of copy: claiming pushes the accrued WAX voting rewards into the RAM.CHZ liquid WAX pool
  - a **Claim** button, CheeseHub yellow, full width of the box
- Button states:
  - enabled when a wallet is connected, there is a claimable amount, and the 24h chain cooldown has passed
  - opaque/disabled while claiming, when the amount is 0, or while the cooldown is still running (shows `Available in 3h 12m` instead)
- On success: success dialog with the TX ID, the claimable figure resets to 0, the button goes opaque, and the Liquid WAX value plus the resource gauges and stats refresh (reusing the existing staggered refresh already wired for buy/sell).
- Placement: between `LiquidReservesPanel` and `RamPricePanel`, same `max-w-lg` width and card styling as the rest of the page.

## Data

Claimable WAX is derived on-chain exactly the way the CHEESEWallet vote-rewards panel already does it, but for the contract account instead of the user:

- `eosio::voters` row for `ram.chz` — `unpaid_voteshare`, `unpaid_voteshare_change_rate`, `unpaid_voteshare_last_updated`, `last_claim_time`
- `eosio::global` — `voters_bucket`, `total_unpaid_voteshare`
- estimate = `(unpaid_voteshare + change_rate * elapsed) / total_unpaid_voteshare * voters_bucket`
- cooldown = `last_claim_time + 24h`

## Technical notes

- New helper in `src/lib/cheeseRam.ts`: `fetchContractVoteRewards()` returning `{ claimable, lastClaimTime, canClaim }`, using the existing `fetchWithFallback` + `WAX_ENDPOINTS` pattern.
- New hook `src/hooks/useCheeseRamVoteRewards.ts` (react-query, 30s stale / 60s refetch) plus a 1s ticker in the component for the live accrual display.
- New component `src/components/ram/FundWaxPoolCard.tsx` — signs `{ account: 'ram.chz', name: 'claimvotes', data: {} }` with the connected session through `getTransactPlugins` (Greymass Fuel), verifies the TX ID, reports via `TransactionSuccessContext`, and parses failures with `parseTransactError`.
- `src/pages/Ram.tsx`: render the card under `LiquidReservesPanel`, add the vote-rewards refetch into the existing `refreshAll` callback so a claim also refreshes reserves, gauges and stats.
- The `claimvotes` action takes no arguments. If the on-chain contract restricts it to the admin authority, the signed transaction will fail with a missing-authority error — that case is surfaced as a clear toast, and the contract itself would need a permission change to allow public claiming. This is the one point to confirm on the first live claim attempt.
- No new terms-of-use checkbox: this is not a user-funds transaction, matching how the existing wallet claim buttons behave.
