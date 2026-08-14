# CHEESERam — `ram.cheese` Smart Contract + CHEESEHub dApp

Buy WAX RAM with $CHEESE, and sell RAM back for $CHEESE. On a buy, the contract values the incoming CHEESE in WAX from the Alcor CHEESE/WAX pool, spends that much WAX from its liquid reserve on `eosio::buyram` for the recipient, and sends every CHEESE it received to `eosio.null`. On a sell, the user transfers RAM bytes to the contract, the contract sells them for WAX (keeping the WAX) and pays the seller CHEESE from its own CHEESE pool. Same shape as `cheesepowerz`, but for RAM.

## Confirmed decisions
- Users can enter either a CHEESE amount or a target RAM size (two tabs).
- No margin: the full WAX equivalent of the CHEESE is spent on RAM.
- The memo can name any existing account as the RAM receiver; it defaults to the sender.
- Selling pays out at the same Alcor rate as buying, with no spread.
- The sell-side CHEESE pool is funded by admin deposits only. CHEESE from buys is still nulled in full, and sells are disabled automatically when the pool runs low.

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

## How a sale flows

```text
User  --eosio::ramtransfer(bytes)-->  ram.cheese
                                         |
                  eosio::sellram(bytes)  |  contract sells the received RAM, keeps the WAX
                  read swap.alcor pool   |  WAX-per-CHEESE rate + deviation guard
                  cheeseburger::transfer |  CHEESE pool pays the seller
                  update stats + logsell |
```

WAX has `eosio::ramtransfer(from, to, bytes, memo)`, so RAM can be handed to a contract account. The contract then owns those bytes and can legitimately call `eosio::sellram` on itself. The WAX proceeds stay in the reserve, which is exactly what makes the buy side sustainable: buys drain WAX and null CHEESE, sells refill WAX and drain the CHEESE pool.

## Part 1 — The contract (`contracts/ramcheese/`)

New C++ contract mirroring the structure of `cheesepowerz`, deployed to the `ram.cheese` account.

### Tables
- `config` singleton: `admin`, `min_cheese`, `max_cheese`, `enabled`, `alcor_market_id` (CHEESE/WAX pool), `reference_rate`, `max_deviation_pct`, `min_liquid_reserve` (WAX that must remain liquid after a purchase, so the pool is never drained to zero), plus the sell-side settings `sell_enabled`, `min_sell_bytes`, `max_sell_bytes`, and `min_cheese_pool` (the CHEESE floor below which sells are refused).
- `stats` table (single row): `total_purchases`, `total_cheese_received`, `total_wax_spent`, `total_bytes_sold`, `total_sales`, `total_bytes_bought_back`, `total_cheese_paid_out`, `total_wax_received`.
- Read-only external mirrors, copied from `cheesepowerz`: `swap.alcor::pools` for the rate, and `eosio.token::accounts` for the contract's own liquid WAX balance. Plus `eosio::rammarket` so the contract can report the bytes purchased.

### Actions
- `setconfig(admin, min_cheese, max_cheese, enabled, alcor_market_id, reference_rate, max_deviation_pct, min_liquid_reserve)` — admin only.
- `setrate(reference_rate, max_deviation_pct)` — quick rate-guard update, admin only.
- `stake(asset quantity)` / `unstake(asset quantity)` — admin only; wrap `eosio::delegatebw` and `eosio::undelegatebw` on the contract's own account so the treasury can hold most of its WAX staked while keeping a liquid slice for RAM buys.
- `withdraw(name to, asset quantity)` — admin-only escape hatch for treasury management.
- `logbuy(sender, recipient, cheese_sent, wax_spent, bytes_bought)` — inline notification action so the purchase appears in both accounts' history, the same trick `logpowerup` uses.
- `[[eosio::on_notify("cheeseburger::transfer")]] on_cheese_transfer(from, to, quantity, memo)` — the entry point.
- `setsellcfg(sell_enabled, min_sell_bytes, max_sell_bytes, min_cheese_pool)` — admin only, tunes the sell side without touching the buy config.
- `logsell(seller, bytes_sold, wax_received, cheese_paid)` — inline notification action so the sale lands in the seller's account history.
- `[[eosio::on_notify("eosio::ramtransfer")]] on_ram_transfer(from, to, bytes, memo)` — the sell entry point.

### Sell-side entry point
A first implementation step is confirming that WAX's `eosio.system` calls `require_recipient` on the `to` account for `ramtransfer`. If it does, `on_notify("eosio::ramtransfer")` is all that is needed. If it does not notify, the fallback is to listen on `eosio::logramchange` (which notifies the owner whose RAM changed) and reconcile against a pending-sell row the user creates with an explicit `sellram` action in the same transaction. The plan assumes the notification path and treats the fallback as a contingency.

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

### `on_ram_transfer` logic
1. Ignore transfers where `to` is not the contract, and ignore the contract's own outgoing transfers.
2. `check(config.sell_enabled)` and require `bytes` to sit between `min_sell_bytes` and `max_sell_bytes`.
3. Call `eosio::sellram{account: ram.cheese, bytes}`. The WAX proceeds land in the contract's liquid balance and stay there.
4. Compute the WAX the sale is worth from the `eosio::rammarket` Bancor reserves, minus the system's 0.5% RAM sale fee, so the payout matches what the contract actually received.
5. Read `wax_per_cheese` from Alcor and run the same deviation guard. Convert the WAX proceeds into CHEESE at that rate, with no spread.
6. Read the contract's own CHEESE balance from `cheeseburger::accounts`. Require that `pool - payout` stays at or above `min_cheese_pool`, otherwise fail with a message telling the seller the CHEESE pool is temporarily empty.
7. Send `cheeseburger::transfer` from `ram.cheese` to the seller for the payout.
8. Update `stats` and send the `logsell` inline action.

### Funding and topping up the CHEESE pool
- CHEESE transfers to `ram.cheese` with the memo `deposit` (or from the admin account) are treated as pool funding: they are recorded and left in place instead of triggering a RAM buy. This is the only inflow to the sell pool.
- `withdrawcheese(name to, asset quantity)` — admin only, so pool funds can be recovered.
- Because buys still null 100% of their CHEESE, the pool only shrinks with use. The dApp surfaces the remaining pool prominently and the contract flips sells off on its own once `min_cheese_pool` is reached, so the failure mode is a clear "sells paused" state rather than a broken transaction.

### Account setup on `ram.cheese`
- `eosio.code` permission added to `active` so the contract can sign its own inline actions.
- Enough RAM on the account itself for its tables.
- Treasury WAX: the majority staked through `stake`, with a liquid working balance for buys.
- `min_cheese` and `max_cheese` set so a single transfer cannot exhaust the liquid pool.
- An initial CHEESE deposit sized to whatever sell volume you want to support.

## Part 2 — The CHEESEHub dApp

### New files
- `src/pages/CheeseRam.tsx` — page shell copying the `PowerUp.tsx` layout: `py-20` hero with radial gradient, floating clickable orb with a fart sound, emoji-title-BETA-emoji heading, then card, leaderboard, stats bar, and a footer line linking to `waxblock.io/account/ram.cheese`.
- `src/components/ram/RamCard.tsx` — the main card with a top-level Buy / Sell switch.
- Buy mode: recipient input reusing `RecipientInput`, then two tabs:
  - **Pay with CHEESE** — enter CHEESE, see the estimated KB of RAM.
  - **Buy by size** — enter the KB or MB wanted, see the CHEESE required.
  Both tabs feed one estimate panel and one submit button. A Terms of Use checkbox with `TermsDialog` gates the transfer.
- Sell mode: shows the connected account's free RAM, a bytes input with a Max button, the estimated CHEESE payout, and the remaining CHEESE pool. Disabled with a clear "sells paused, pool empty" state when the pool is below `min_cheese_pool` or `sell_enabled` is false. Also gated by the Terms checkbox, since it moves user assets.
- `src/components/ram/RamEstimate.tsx` — shows RAM bytes, WAX equivalent, current RAM price per KB, and USD value, with a refresh button, modelled on `ResourceEstimate`.
- `src/components/ram/RamStatsBar.tsx` — total purchases, CHEESE nulled, WAX spent, total RAM sold, sales count, CHEESE paid out, and the two live reserves: liquid WAX and the CHEESE pool.
- `src/components/ram/RamLeaderboard.tsx` — top RAM buyers and sellers, built the same way as `PowerupLeaderboard` from Hyperion action history.
- `src/hooks/useRamPrice.ts` — reads `eosio::rammarket` through the existing multi-endpoint RPC fallback and returns WAX per KB, cached with react-query.
- `src/hooks/useRamStats.ts` — reads the `ram.cheese` `stats` and `config` tables plus its liquid WAX and CHEESE balances, using the same endpoint-fallback pattern as `usePowerupStats`.
- `src/hooks/useAccountRam.ts` — reads the connected account's RAM quota and usage so the sell tab can show free bytes and a working Max button.
- `src/hooks/useRamEstimate.ts` — combines `useRamPrice` with `useCheesePriceData` to convert between CHEESE, WAX, and bytes in both directions.
- `src/lib/ramCheese.ts` — contract constants (`ram.cheese`, min and max amounts, memo format) and builders for both the buy transfer action and the `eosio::ramtransfer` sell action.

### Wiring
- Route `/cheeseram` added to `src/App.tsx` above the catch-all.
- Nav entry in `src/components/Header.tsx` alongside CHEESEUp.
- A CHEESE tools tile on `src/pages/Index.tsx` with an OpenMoji icon and a short description.
- The transfer goes through `useWaxTransaction` and `getTransactPlugins` so Greymass Fuel is attempted and the TX ID is verified, matching every other CHEESEHub transaction.

## Part 3 — Build and deploy

Reuse the Docker workflow from the previous guide: compile in the Antelope CDT container to produce `ramcheese.wasm` and `ramcheese.abi`, deploy to `ram.cheese` with `cleos set contract` or the block explorer upload, then call `setconfig` and `setsellcfg` once each with the CHEESE/WAX Alcor pool id, the limits, the reference rate, the liquid WAX reserve floor, and the CHEESE pool floor. Test both directions on WAX testnet with a mock CHEESE token before going to mainnet, and confirm the `ramtransfer` notification actually reaches the contract there before writing the frontend sell flow.

## Technical notes and risks
- **RAM price moves with every trade.** The frontend estimate is indicative only; the contract spends a fixed WAX amount and the bytes received are whatever the Bancor market gives at execution time. The UI should say so, exactly like the CHEESEUp estimate disclaimer.
- **Staked WAX cannot buy RAM.** Only the liquid balance is spendable, which is why `min_liquid_reserve` and the admin `stake` and `unstake` actions exist. If the liquid pool runs dry, purchases fail with a readable error instead of a confusing revert.
- **Price manipulation.** The `reference_rate` and `max_deviation_pct` guard from `cheesepowerz` carries over unchanged and should be kept current.
- **RAM sold to the receiver is theirs.** They can sell it back for WAX at market, so a rate error in the buyer's favour is not recoverable; the deviation guard and a conservative `max_cheese` are the main protections.
- **The sell pool is finite.** With admin deposits as the only inflow, sustained selling empties it. Selling gets paused automatically at the floor, and refilling is a manual deposit. If that becomes a chore, the natural upgrade later is diverting a configurable share of buy CHEESE into the pool instead of nulling it, which is a config-level change rather than a redesign.
- **Round-trip loss is real for users.** Buying and immediately selling RAM loses the system's 0.5% RAM sale fee plus whatever the Bancor curve moved, even with no contract spread. The UI should show the payout estimate clearly so nobody expects a break-even round trip.
- **RAM cannot be un-transferred.** Once a user sends bytes via `ramtransfer`, the contract owns them. The sell handler must never be able to accept RAM and then fail to pay: the CHEESE pool check happens before `sellram` is sent, so an underfunded pool aborts the whole transaction and the RAM stays with the user.
- **Admin key hygiene.** Prefer a dedicated permission on `ram.cheese` limited to the admin actions rather than using the full `active` key day to day.