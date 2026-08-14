# CHEESERam — `ram.cheese` Smart Contract + CHEESEHub dApp

Buy WAX RAM with $CHEESE. The contract receives CHEESE, values it in WAX from the Alcor CHEESE/WAX pool, spends that much WAX from its liquid reserve on `eosio::buyram` for the recipient, and sends every CHEESE it received to `eosio.null`. Same shape as `cheesepowerz`, but RAM instead of CPU/NET.

## Confirmed decisions
- Users can enter either a CHEESE amount or a target RAM size (two tabs).
- No margin: the full WAX equivalent of the CHEESE is spent on RAM.
- The memo can name any existing account as the RAM receiver; it defaults to the sender.

## How a purchase flows

```text
User  --transfer CHEESE, memo "recipient"-->  ram.cheese
                                                 |
                          read swap.alcor pool   |  WAX-per-CHEESE rate
                          check price deviation  |  (reject manipulated rates)
                                                 |
                          eosio::buyram          |  payer=ram.cheese, receiver=recipient
                          cheeseburger::transfer |  quantity sent to eosio.null
                          update stats + logbuy  |
```

## Part 1 — The contract (`contracts/ramcheese/`)

New C++ contract mirroring the structure of `cheesepowerz`, deployed to the `ram.cheese` account.

### Tables
- `config` singleton: `admin`, `min_cheese`, `max_cheese`, `enabled`, `alcor_market_id` (CHEESE/WAX pool), `reference_rate`, `max_deviation_pct`, plus `min_liquid_reserve` (WAX that must remain liquid after a purchase, so the pool is never drained to zero).
- `stats` table (single row): `total_purchases`, `total_cheese_received`, `total_wax_spent`, `total_bytes_sold`.
- Read-only external mirrors, copied from `cheesepowerz`: `swap.alcor::pools` for the rate, and `eosio.token::accounts` for the contract's own liquid WAX balance. Plus `eosio::rammarket` so the contract can report the bytes purchased.

### Actions
- `setconfig(admin, min_cheese, max_cheese, enabled, alcor_market_id, reference_rate, max_deviation_pct, min_liquid_reserve)` — admin only.
- `setrate(reference_rate, max_deviation_pct)` — quick rate-guard update, admin only.
- `stake(asset quantity)` / `unstake(asset quantity)` — admin only; wrap `eosio::delegatebw` and `eosio::undelegatebw` on the contract's own account so the treasury can hold most of its WAX staked while keeping a liquid slice for RAM buys.
- `withdraw(name to, asset quantity)` — admin-only escape hatch for treasury management.
- `logbuy(sender, recipient, cheese_sent, wax_spent, bytes_bought)` — inline notification action so the purchase appears in both accounts' history, the same trick `logpowerup` uses.
- `[[eosio::on_notify("cheeseburger::transfer")]] on_cheese_transfer(from, to, quantity, memo)` — the entry point.

### `on_cheese_transfer` logic
1. Ignore outgoing and self transfers.
2. `check(config.enabled)`, symbol is CHEESE, amount within `min_cheese` and `max_cheese`.
3. Parse the memo: empty means the sender, otherwise the memo is the receiver account name. `check(is_account(recipient))`.
4. Read `wax_per_cheese` from the Alcor pool, `check(rate > 0)`, then run the deviation guard against `reference_rate`.
5. Convert: `wax_units = cheese_amount * wax_per_cheese`, rounded to WAX's 8 decimals. `check(wax_units > 0)`.
6. Read the contract's own liquid WAX from `eosio.token::accounts` and require that `liquid - wax_to_spend` stays at or above `min_liquid_reserve`, with a clear error telling the user to try a smaller amount.
7. Compute the bytes the purchase will yield from the `eosio::rammarket` Bancor reserves, for stats and the log.
8. Send `eosio::buyram` with `payer: ram.cheese`, `receiver: recipient`, `quant: wax_to_spend`.
9. Send `cheeseburger::transfer` from `ram.cheese` to `eosio.null` for the full received quantity.
10. Update `stats` and send the `logbuy` inline action.

### Account setup on `ram.cheese`
- `eosio.code` permission added to `active` so the contract can sign its own inline actions.
- Enough RAM on the account itself for its tables.
- Treasury WAX: the majority staked through `stake`, with a liquid working balance for buys.
- `min_cheese` and `max_cheese` set so a single transfer cannot exhaust the liquid pool.

## Part 2 — The CHEESEHub dApp

### New files
- `src/pages/CheeseRam.tsx` — page shell copying the `PowerUp.tsx` layout: `py-20` hero with radial gradient, floating clickable orb with a fart sound, emoji-title-BETA-emoji heading, then card, leaderboard, stats bar, and a footer line linking to `waxblock.io/account/ram.cheese`.
- `src/components/ram/RamBuyCard.tsx` — the main card. Recipient input reusing `RecipientInput`, then two tabs:
  - **Pay with CHEESE** — enter CHEESE, see the estimated KB of RAM.
  - **Buy by size** — enter the KB or MB wanted, see the CHEESE required.
  Both tabs feed one estimate panel and one submit button. A Terms of Use checkbox with `TermsDialog` gates the transfer.
- `src/components/ram/RamEstimate.tsx` — shows RAM bytes, WAX equivalent, current RAM price per KB, and USD value, with a refresh button, modelled on `ResourceEstimate`.
- `src/components/ram/RamStatsBar.tsx` — total purchases, CHEESE nulled, WAX spent, total RAM sold, and the available liquid reserve.
- `src/components/ram/RamLeaderboard.tsx` — top RAM buyers, built the same way as `PowerupLeaderboard` from Hyperion action history.
- `src/hooks/useRamPrice.ts` — reads `eosio::rammarket` through the existing multi-endpoint RPC fallback and returns WAX per KB, cached with react-query.
- `src/hooks/useRamStats.ts` — reads the `ram.cheese` `stats` table plus its liquid WAX balance, using the same endpoint-fallback pattern as `usePowerupStats`.
- `src/hooks/useRamEstimate.ts` — combines `useRamPrice` with `useCheesePriceData` to convert between CHEESE, WAX, and bytes in both directions.
- `src/lib/ramCheese.ts` — contract constants (`ram.cheese`, min and max amounts, memo format) and the transfer action builder.

### Wiring
- Route `/cheeseram` added to `src/App.tsx` above the catch-all.
- Nav entry in `src/components/Header.tsx` alongside CHEESEUp.
- A CHEESE tools tile on `src/pages/Index.tsx` with an OpenMoji icon and a short description.
- The transfer goes through `useWaxTransaction` and `getTransactPlugins` so Greymass Fuel is attempted and the TX ID is verified, matching every other CHEESEHub transaction.

## Part 3 — Build and deploy

Reuse the Docker workflow from the previous guide: compile in the Antelope CDT container to produce `ramcheese.wasm` and `ramcheese.abi`, deploy to `ram.cheese` with `cleos set contract` or the block explorer upload, then call `setconfig` once with the CHEESE/WAX Alcor pool id, the limits, the reference rate, and the liquid reserve floor. Test the whole flow on WAX testnet with a mock CHEESE token before going to mainnet.

## Technical notes and risks
- **RAM price moves with every trade.** The frontend estimate is indicative only; the contract spends a fixed WAX amount and the bytes received are whatever the Bancor market gives at execution time. The UI should say so, exactly like the CHEESEUp estimate disclaimer.
- **Staked WAX cannot buy RAM.** Only the liquid balance is spendable, which is why `min_liquid_reserve` and the admin `stake` and `unstake` actions exist. If the liquid pool runs dry, purchases fail with a readable error instead of a confusing revert.
- **Price manipulation.** The `reference_rate` and `max_deviation_pct` guard from `cheesepowerz` carries over unchanged and should be kept current.
- **RAM sold to the receiver is theirs.** They can sell it back for WAX at market, so a rate error in the buyer's favour is not recoverable; the deviation guard and a conservative `max_cheese` are the main protections.
- **Admin key hygiene.** Prefer a dedicated permission on `ram.cheese` limited to the admin actions rather than using the full `active` key day to day.