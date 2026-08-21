# `ram.cheese` — from here on

Docker, VS Code, the `waxcdt` image, `CMakeLists.txt` and the toolchain flag are all done and working. Below is only what is left, in order. (The earlier setup steps are archived — ask if you want them back.)

## Step 1 — Paste the contract code (this is why your last build failed)

Read your last output again: the toolchain part now works perfectly.

```text
-- Setting up CDT Wasm Toolchain 4.1.1 at /usr
-- The CXX compiler identification is Clang 9.0.1
```

Docker, CDT, CMake and the toolchain flag are all correct now. The two lines that stopped it are:

```text
Warning, contract is empty and ABI is not generated
wasm-ld: error: fatal failure: contract with no actions and trying to create dispatcher
```

In plain English: your `src/ramcheese.cpp` and `include/ramcheese.hpp` are still empty files. The compiler compiled nothing, found no actions, and refused to produce a contract that can never be called. Nothing is broken — you just have not written the contract yet. (`--- failed` on the two "compiler ABI info" lines is normal for a Wasm compiler and is not an error.)

`include/ramcheese.hpp` — the declarations. Click it in the VS Code panel, paste all of this, Ctrl+S:

```cpp
#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>
#include <eosio/system.hpp>
#include <string>

using namespace eosio;

// Read-only view of any eosio.token-style contract's balance table.
namespace tokenview {
   struct account {
      asset balance;
      uint64_t primary_key() const { return balance.symbol.code().raw(); }
   };
   typedef multi_index<name("accounts"), account> accounts;
}

CONTRACT ramcheese : public contract {
public:
   using contract::contract;

   static constexpr symbol WAX_SYM      = symbol("WAX", 8);
   static constexpr symbol CHEESE_SYM   = symbol("CHEESE", 4);
   static constexpr name   WAX_TOKEN    = name("eosio.token");
   static constexpr name   CHEESE_TOKEN = name("cheeseburger");
   static constexpr name   NULL_ACCT    = name("eosio.null");
   static constexpr name   SYSTEM_ACCT  = name("eosio");

   ACTION setconfig(name owner, name oracle, asset min_buy, asset max_buy,
                    uint16_t buy_fee_bps, uint16_t sell_fee_bps,
                    asset wax_reserve_floor, asset cheese_pool_floor,
                    int64_t min_sell_bytes, int64_t max_sell_bytes);

   ACTION setrates(asset cheese_per_wax, asset wax_per_kb, uint16_t max_deviation_bps);

   ACTION setpause(bool buy_paused, bool sell_paused);

   ACTION withdraw(name token_contract, name to, asset quantity, std::string memo);

   [[eosio::on_notify("cheeseburger::transfer")]]
   void on_cheese(name from, name to, asset quantity, std::string memo);

   [[eosio::on_notify("eosio::ramtransfer")]]
   void on_ram(name from, name to, int64_t bytes, std::string memo);

   TABLE config_row {
      name           owner;
      name           oracle;
      asset          min_buy;
      asset          max_buy;
      uint16_t       buy_fee_bps       = 0;
      uint16_t       sell_fee_bps      = 0;
      asset          wax_reserve_floor;
      asset          cheese_pool_floor;
      int64_t        min_sell_bytes    = 0;
      int64_t        max_sell_bytes    = 0;
      asset          cheese_per_wax;
      asset          wax_per_kb;
      uint16_t       max_deviation_bps = 1000;
      bool           buy_paused        = false;
      bool           sell_paused       = false;
      time_point_sec rates_updated;
   };
   typedef singleton<name("config"), config_row> config_tbl;

   TABLE stats_row {
      asset    cheese_nulled;
      asset    wax_spent;
      asset    cheese_paid;
      int64_t  bytes_bought = 0;
      int64_t  bytes_sold   = 0;
      uint64_t buys         = 0;
      uint64_t sells        = 0;
   };
   typedef singleton<name("stats"), stats_row> stats_tbl;

private:
   config_row load_config();
   stats_row  load_stats();
   asset      balance_of(name token_contract, symbol sym);
   void       pay(name token_contract, name to, asset quantity, const std::string& memo);
};
```

`src/ramcheese.cpp` — the logic. Click it, paste all of this, Ctrl+S:

```cpp
#include "ramcheese.hpp"

using std::string;

ramcheese::config_row ramcheese::load_config() {
   config_tbl cfg(get_self(), get_self().value);
   check(cfg.exists(), "ram.cheese is not configured yet: call setconfig first");
   return cfg.get();
}

ramcheese::stats_row ramcheese::load_stats() {
   stats_tbl st(get_self(), get_self().value);
   if (st.exists()) return st.get();
   stats_row row;
   row.cheese_nulled = asset(0, CHEESE_SYM);
   row.wax_spent     = asset(0, WAX_SYM);
   row.cheese_paid   = asset(0, CHEESE_SYM);
   return row;
}

asset ramcheese::balance_of(name token_contract, symbol sym) {
   tokenview::accounts acc(token_contract, get_self().value);
   auto it = acc.find(sym.code().raw());
   return it == acc.end() ? asset(0, sym) : it->balance;
}

void ramcheese::pay(name token_contract, name to, asset quantity, const string& memo) {
   action(
      permission_level{get_self(), name("active")},
      token_contract, name("transfer"),
      std::make_tuple(get_self(), to, quantity, memo)
   ).send();
}
```

**Part 2 of 4** — paste at the bottom of `src/ramcheese.cpp`:

```cpp

void ramcheese::setconfig(name owner, name oracle, asset min_buy, asset max_buy,
                          uint16_t buy_fee_bps, uint16_t sell_fee_bps,
                          asset wax_reserve_floor, asset cheese_pool_floor,
                          int64_t min_sell_bytes, int64_t max_sell_bytes) {
   config_tbl cfg(get_self(), get_self().value);
   config_row row;
   if (cfg.exists()) {
      row = cfg.get();
      require_auth(row.owner);
   } else {
      require_auth(get_self());
      row.cheese_per_wax    = asset(0, CHEESE_SYM);
      row.wax_per_kb        = asset(0, WAX_SYM);
      row.max_deviation_bps = 1000;
      row.buy_paused        = false;
      row.sell_paused       = false;
      row.rates_updated     = time_point_sec(0);
   }

   check(is_account(owner),  "owner account does not exist");
   check(is_account(oracle), "oracle account does not exist");
   check(min_buy.symbol == CHEESE_SYM && max_buy.symbol == CHEESE_SYM, "buy limits must be CHEESE");
   check(min_buy.amount > 0 && max_buy.amount >= min_buy.amount, "bad buy limits");
   check(wax_reserve_floor.symbol == WAX_SYM && wax_reserve_floor.amount >= 0, "wax_reserve_floor must be WAX");
   check(cheese_pool_floor.symbol == CHEESE_SYM && cheese_pool_floor.amount >= 0, "cheese_pool_floor must be CHEESE");
   check(buy_fee_bps <= 2000 && sell_fee_bps <= 2000, "fees are capped at 20%");
   check(min_sell_bytes > 0 && max_sell_bytes >= min_sell_bytes, "bad sell size limits");

   row.owner             = owner;
   row.oracle            = oracle;
   row.min_buy           = min_buy;
   row.max_buy           = max_buy;
   row.buy_fee_bps       = buy_fee_bps;
   row.sell_fee_bps      = sell_fee_bps;
   row.wax_reserve_floor = wax_reserve_floor;
   row.cheese_pool_floor = cheese_pool_floor;
   row.min_sell_bytes    = min_sell_bytes;
   row.max_sell_bytes    = max_sell_bytes;
   cfg.set(row, get_self());
}

void ramcheese::setrates(asset cheese_per_wax, asset wax_per_kb, uint16_t max_deviation_bps) {
   config_tbl cfg(get_self(), get_self().value);
   check(cfg.exists(), "call setconfig first");
   config_row row = cfg.get();
   check(has_auth(row.oracle) || has_auth(row.owner), "only the oracle or the owner can set rates");

   check(cheese_per_wax.symbol == CHEESE_SYM && cheese_per_wax.amount > 0, "cheese_per_wax must be positive CHEESE");
   check(wax_per_kb.symbol == WAX_SYM && wax_per_kb.amount > 0, "wax_per_kb must be positive WAX");
   check(max_deviation_bps > 0 && max_deviation_bps <= 5000, "max_deviation_bps out of range");

   if (row.cheese_per_wax.amount > 0 && !has_auth(row.owner)) {
      int128_t old_v = row.cheese_per_wax.amount;
      int128_t new_v = cheese_per_wax.amount;
      int128_t diff  = new_v > old_v ? new_v - old_v : old_v - new_v;
      check(diff * 10000 <= old_v * (int128_t)row.max_deviation_bps,
            "new rate deviates too far from the stored rate; the owner must confirm it");
   }

   row.cheese_per_wax    = cheese_per_wax;
   row.wax_per_kb        = wax_per_kb;
   row.max_deviation_bps = max_deviation_bps;
   row.rates_updated     = time_point_sec(current_time_point());
   cfg.set(row, get_self());
}
```

**Part 3 of 4** — paste at the bottom of `src/ramcheese.cpp`:

```cpp

void ramcheese::setpause(bool buy_paused, bool sell_paused) {
   config_tbl cfg(get_self(), get_self().value);
   check(cfg.exists(), "call setconfig first");
   config_row row = cfg.get();
   require_auth(row.owner);
   row.buy_paused  = buy_paused;
   row.sell_paused = sell_paused;
   cfg.set(row, get_self());
}

void ramcheese::withdraw(name token_contract, name to, asset quantity, string memo) {
   config_row row = load_config();
   require_auth(row.owner);
   check(quantity.amount > 0, "quantity must be positive");
   check(is_account(to), "destination account does not exist");
   pay(token_contract, to, quantity, memo);
}
```

**Part 4 of 4** — paste at the very bottom of `src/ramcheese.cpp`, save with Ctrl+S:

```cpp

// BUY RAM: someone sends CHEESE, the contract spends its own liquid WAX on RAM for
// them, and the CHEESE it received is nulled.
void ramcheese::on_cheese(name from, name to, asset quantity, string memo) {
   if (to != get_self() || from == get_self()) return;   // outgoing, or not for us
   if (memo == "deposit") return;                        // owner funding the CHEESE payout pool

   config_row row = load_config();
   check(!row.buy_paused, "RAM buying is paused");
   check(quantity.symbol == CHEESE_SYM, "only CHEESE is accepted here");
   check(row.cheese_per_wax.amount > 0, "no CHEESE/WAX rate is set yet");
   check(quantity >= row.min_buy, "below the minimum purchase");
   check(quantity <= row.max_buy, "above the maximum purchase");

   name receiver = from;
   if (!memo.empty()) {
      check(memo.size() <= 12, "memo must be empty or a WAX account name");
      receiver = name(memo);
      check(is_account(receiver), "the account in the memo does not exist");
   }

   // CHEESE -> WAX using the stored rate, then take the buy fee.
   int128_t gross = (int128_t)quantity.amount * 100000000 / (int128_t)row.cheese_per_wax.amount;
   int128_t net   = gross * (10000 - (int128_t)row.buy_fee_bps) / 10000;
   check(net > 0, "amount too small to buy any RAM");
   asset wax_spend = asset((int64_t)net, WAX_SYM);

   asset liquid = balance_of(WAX_TOKEN, WAX_SYM);
   check(liquid >= wax_spend + row.wax_reserve_floor,
         "not enough liquid WAX in the contract right now; try a smaller amount");

   action(permission_level{get_self(), name("active")}, SYSTEM_ACCT, name("buyram"),
          std::make_tuple(get_self(), receiver, wax_spend)).send();

   pay(CHEESE_TOKEN, NULL_ACCT, quantity, "ram.cheese: CHEESE nulled for a RAM purchase");

   stats_tbl st(get_self(), get_self().value);
   stats_row s = load_stats();
   s.cheese_nulled += quantity;
   s.wax_spent     += wax_spend;
   s.buys          += 1;
   st.set(s, get_self());
}

// SELL RAM: someone transfers RAM bytes to the contract, the contract sells them
// for WAX (which it keeps) and pays the seller CHEESE out of its pool.
void ramcheese::on_ram(name from, name to, int64_t bytes, string memo) {
   if (to != get_self() || from == get_self()) return;
   if (memo == "deposit") return;                        // owner topping up contract RAM

   config_row row = load_config();
   check(!row.sell_paused, "RAM selling is paused");
   check(row.cheese_per_wax.amount > 0 && row.wax_per_kb.amount > 0, "no rates are set yet");
   check(bytes >= row.min_sell_bytes, "below the minimum sell size");
   check(bytes <= row.max_sell_bytes, "above the maximum sell size");

   int128_t wax_units    = (int128_t)bytes * (int128_t)row.wax_per_kb.amount / 1024;
   int128_t cheese_units = wax_units * (int128_t)row.cheese_per_wax.amount / 100000000;
   cheese_units          = cheese_units * (10000 - (int128_t)row.sell_fee_bps) / 10000;
   check(cheese_units > 0, "amount too small to pay out");
   asset payout = asset((int64_t)cheese_units, CHEESE_SYM);

   asset pool = balance_of(CHEESE_TOKEN, CHEESE_SYM);
   check(pool >= payout + row.cheese_pool_floor, "the CHEESE payout pool is too low right now");

   action(permission_level{get_self(), name("active")}, SYSTEM_ACCT, name("sellram"),
          std::make_tuple(get_self(), bytes)).send();

   pay(CHEESE_TOKEN, from, payout, "ram.cheese: CHEESE for RAM sold");

   stats_tbl st(get_self(), get_self().value);
   stats_row s = load_stats();
   s.cheese_paid += payout;
   s.bytes_sold  += bytes;
   s.sells       += 1;
   st.set(s, get_self());
}
```

Then re-run the Step 2 compile command. You are looking for `ramcheese.wasm` **and** `ramcheese.abi` in the `build` folder, with no `wasm-ld` error.

**Two things to know about this code before deploying it.**

1. **Pricing comes from a rate you push in, not from Alcor on-chain.** Alcor's pools store price as a 128-bit square-root value needing heavy maths a contract should not do, so this version keeps `cheese_per_wax` and `wax_per_kb` in the `config` table. The `oracle` account (a small script, or you) calls `setrates` on a schedule; `max_deviation_bps` rejects any jump bigger than you allow unless the owner signs it. A stale rate is the main risk — keep the updater running and the guard tight.
2. **The sell flow depends on `eosio::ramtransfer` existing on WAX.** Before deploying, open `eosio` on waxblock.io -> Contract -> ABI and search for `ramtransfer`. If it is there, the sell flow works as written. If it is not, WAX's system contract predates that feature and the sell side needs a different design — tell me and I will rework it. The buy side is unaffected either way.

## Step 2 — Compile
Do this: in the terminal, move into your project folder first (VS Code's built-in terminal with Ctrl+` already starts there).

**First, delete the old build folder** if one exists — it caches the compiler choice:

```powershell
Remove-Item -Recurse -Force build
```

(macOS/Linux: `rm -rf build`.)

Windows PowerShell:
```powershell
docker run --rm -v "${PWD}:/project" -w /project waxcdt `
  bash -c "mkdir -p build && cd build && cmake -DCMAKE_TOOLCHAIN_FILE=/usr/lib/cmake/cdt/CDTWasmToolchain.cmake .. && make"
```

macOS / Linux:
```bash
docker run --rm -v "$(pwd)":/project -w /project waxcdt \
  bash -c "mkdir -p build && cd build && cmake -DCMAKE_TOOLCHAIN_FILE=/usr/lib/cmake/cdt/CDTWasmToolchain.cmake .. && make"
```

You know it worked when the `build` folder contains:
- `ramcheese.wasm` — the compiled contract
- `ramcheese.abi` — the interface file wallets and explorers read

You need both to deploy.

**Troubleshooting Step 2:**
- `contract with no actions and trying to create dispatcher` / `Warning, contract is empty` — the two files are still empty. Go back to Step 1, paste both, save both.
- `unrecognized command-line option '-abigen'` — the toolchain flag is missing, or a stale `build` folder is being reused. Delete `build`, re-run the full command.
- An error naming one of your own files with a line number (e.g. `src/ramcheese.cpp:42`) — that is a mistake in the C++, not in Docker. Fix that line. Paste me the error and I will fix it.
- `Could not find a package configuration file provided by cdt` — you ran `cmake` on Windows instead of inside the container. Use the `docker run ...` command exactly as written.

## Step 3 (optional) — Stop typing the long docker command
Right-click empty space in the VS Code panel -> New Folder -> `.devcontainer`. Inside it create `devcontainer.json` and paste:

```json
{
  "name": "WAX Contract Dev",
  "image": "waxcdt",
  "customizations": {
    "vscode": {
      "extensions": ["ms-vscode.cpptools", "ms-vscode.cmake-tools"]
    }
  }
}
```

Save, press F1, type `Reopen in Container`, pick "Dev Containers: Reopen in Container". VS Code now runs inside the WAX toolchain, so in its terminal you can just run:

```bash
mkdir -p build && cd build && cmake -DCMAKE_TOOLCHAIN_FILE=/usr/lib/cmake/cdt/CDTWasmToolchain.cmake .. && make
```

## Step 4 — Deploy to WAX testnet first. Do not skip this.
A broken contract on mainnet costs real WAX and can lock funds.

1. Create a free testnet account at a faucet such as https://waxsweden.org/testnet/ and save the keys.
2. Deploy there using Step 5 or Step 6, but point at a testnet endpoint: `https://testnet.waxsweden.org`.
3. Call each action once and check the tables in the explorer. Send a mock CHEESE transfer to test a buy, and a `ramtransfer` to test a sell.
4. Only when both work, repeat on mainnet.

## Step 5 — Deploy option A: the block explorer (easiest, you never type a private key)
1. Go to https://waxblock.io (or https://wax.bloks.io), open the `ram.cheese` account, then its contract deploy tool.
2. Click Login, choose your wallet (Anchor, Wombat, WAX Cloud Wallet), log in as `ram.cheese`.
3. Upload `build/ramcheese.wasm` in the WASM field and `build/ramcheese.abi` in the ABI field.
4. Read the transaction preview: it should contain `eosio::setcode` and `eosio::setabi`. If not, you uploaded the wrong files.
5. Sign / Submit and approve in your wallet.
6. Copy the transaction ID and open `https://waxblock.io/transaction/<txid>` to confirm it executed.

If it fails with a RAM error, buy more RAM on `ram.cheese` and retry.

## Step 6 — Deploy option B: command line with cleos
1. Pull the image that contains `cleos`:
   ```bash
   docker pull antelopeio/leap:latest
   ```
2. From your project folder:
   ```bash
   docker run --rm -it -v "$(pwd)":/project -w /project antelopeio/leap:latest bash
   ```
3. Create a wallet and load your key:
   ```bash
   keosd &
   cleos wallet create --to-console
   cleos wallet import
   ```
   `create --to-console` prints a password — save it. `wallet import` prompts for the private key so it never lands in shell history. Never paste a private key directly on a command line.
4. Deploy:
   ```bash
   cleos -u https://wax.greymass.com set contract ram.cheese ./build ramcheese.wasm ramcheese.abi
   ```
5. Check it landed:
   ```bash
   cleos -u https://wax.greymass.com get code ram.cheese
   ```
   The code hash must not be all zeros. All zeros means nothing deployed.

If an endpoint is rate-limited, swap `-u` for `https://wax.eosphere.io`, `https://api.wax.alohaeos.com`, or `https://wax.pink.gg`.

## Step 7 — Set the contract up after deploying
A freshly deployed contract does nothing until configured. In this order:

1. Add `eosio.code` to the `active` permission of `ram.cheese`. In waxblock.io: open the account -> Permissions -> edit `active` -> add `ram.cheese@eosio.code` as an authority -> sign. Without this, every inline action (`buyram`, `sellram`, CHEESE transfers) fails with a missing-authority error.
2. Call `setconfig` once: `owner` (your account), `oracle` (the account that pushes rates), `min_buy` / `max_buy` in CHEESE, `buy_fee_bps` / `sell_fee_bps` (100 = 1%), `wax_reserve_floor` in WAX, `cheese_pool_floor` in CHEESE, `min_sell_bytes` / `max_sell_bytes`.
3. Call `setrates`: current `cheese_per_wax` (CHEESE), `wax_per_kb` (WAX per 1024 bytes of RAM), `max_deviation_bps` (1000 = 10%). Repeat on a schedule from the oracle account.
4. Fund it: send WAX to `ram.cheese` for the buy reserve (no memo needed), and send CHEESE with the memo `deposit` to fill the sell payout pool.
5. Confirm on waxblock.io that the `config` and `stats` tables show your values.

## Step 8 — Safety, before real money touches it
- Create a dedicated permission on `ram.cheese` called `deployer`, parent `active`, linked only to `eosio::setcode` and `eosio::setabi`. Deploy with that key from then on, not your full `active` key.
- Never commit private keys. Add any `.key` files and wallet passwords to `.gitignore`.
- Once the contract holds real value, move control to a multisig so no single key can silently replace the code.

## Quick reference
| What | Where to get it | Why |
| --- | --- | --- |
| `waxcdt` image | already built on your machine | Turns `.cpp` into `.wasm` and `.abi` |
| Leap Docker image | `docker pull antelopeio/leap` | Gives you `cleos` for CLI deployment |
| `ram.cheese` account with RAM | Any WAX wallet or Anchor | Holds and pays for the contract |
| Testnet account | A WAX testnet faucet | Safe place to break things first |
| waxblock.io / bloks.io | Browser | Upload without the CLI, and verify transactions |
