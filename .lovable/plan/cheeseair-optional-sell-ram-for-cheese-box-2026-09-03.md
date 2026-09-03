# CHEESEAir: optional "Sell RAM for CHEESE" box

After an airdrop, users are often left holding RAM they bought with CHEESE. Add a compact,
optional sell box at the bottom of `/air`, directly below the "Run the airdrop" card, so they can
sell that RAM straight back for CHEESE without leaving the page.

## What the box shows

- Title: "Sell RAM for CHEESE" with an "Optional" tag, plus a short line explaining it sells your
  free RAM back to the CHEESERam contract.
- Your free RAM, shown in KB (and exact bytes underneath), with a Max button.
- The current price: CHEESE per KB, and the CHEESE/WAX rate used for the quote (live or contract).
- An input for the amount of RAM to sell. Input is in KB to match the "how many KB free" framing,
  converted to bytes under the hood.
- A live estimated CHEESE return as the user types, with the standard "estimate only — the contract
  calculates the final payout" note.
- Inline warnings for: below contract minimum, above contract maximum, more than your free RAM,
  contract CHEESE pool too low, sales disabled by the contract.
- The standard Terms of Use checkbox (exact existing wording) and a Sell button, same as CHEESERam.
- Not connected: the button reads "Connect Wallet"; balances/estimates show placeholders.

Everything reuses the existing CHEESERam contract logic, so pricing, limits and payout match `/ram`
exactly — this is just a smaller surface for the same sell action.

## Technical details

New file `src/components/air/AirSellRamCard.tsx`:

- Data via existing hooks: `useCheeseRamConfig`, `useRamPrice`, `useAccountRam(accountName)`,
  `useCheesePriceData` (for `liveWaxPerCheese`), `useCheeseRamReserves`.
- Quote and validation via existing helpers in `src/lib/cheeseRam.ts`: `resolveQuoteRate`,
  `estimateCheeseForBytes`, `minSellBytes` / `maxSellBytes` / `sellEnabled` from config.
- Transaction: same `eosio::ramtransfer` to `CHEESE_RAM_CONTRACT` with `SELL_MEMO`, signed through
  `session.transact` with `getTransactPlugins`, plus the existing ambiguous-broadcast recovery
  (`parseTransactError`, `pollForConfirmation` + `findRecentSell`, `UnconfirmedNotice`) so a network
  hiccup can never cause a duplicate sale.
- Success uses `useTransactionSuccess().showSuccess` with the TX ID, then refreshes: `refreshBalance`,
  `refetchAccountRam`, `refetchReserves`, `refreshResourceGauges()`, with staggered repeats at 1.5s,
  4s and 8s (same pattern as `/ram`), so the CHEESEAir gauges and cost panel update immediately.
- Terms gate uses the shared `TermsCheckbox` / `TermsDialog` wording already used site-wide.
- Styling: `rounded-2xl p-6 bg-card border border-border/50`, OpenMoji icon, RAM stick png where the
  existing pages use it — visually consistent with the other CHEESEAir cards.

`src/pages/Air.tsx`: render `<AirSellRamCard />` in a `w-full max-w-lg` wrapper immediately after the
`AirRunPanel` block, keeping the slim stacked width of the other narrow cards.

No contract, backend, or CHEESERam page changes.
