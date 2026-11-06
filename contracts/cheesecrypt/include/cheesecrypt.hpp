#pragma once
// Blind CHEESECrypt atomic payment router. Zero custody: no stored user balances.
// No room IDs, rosters, roles or moderation state.
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>
#include "router_rules.hpp"
#include <string>
#include <vector>

using namespace eosio;
using std::string;
using std::vector;

class [[eosio::contract("cheesecrypt")]] cheesecrypt : public contract {
public:
   using contract::contract;
   struct copy_t {
      name to;
      string memo; // Opaque original encrypted memo. Sender attribution is in sendmsg.
   };

   struct [[eosio::table]] config {
      name token_contract = "cheeseburger"_n;
      symbol token_symbol = symbol("CHEESE", 4);
      name null_account = "eosio.null"_n;
      name liquidity_account = "xcheeseliqst"_n;
      asset part_fee = asset(100, symbol("CHEESE", 4)); // same for text, NFT, links and controls
      asset recipient_fee = asset(1, symbol("CHEESE", 4));
      uint8_t null_percent = 80;
      uint32_t max_recipients = crypt_router::HARD_MAX_RECIPIENTS;
      uint16_t max_parts = crypt_router::HARD_MAX_PARTS;
      bool paused = false;
   };
   using config_singleton = singleton<"config"_n, config>;

   // Transient in-flight payment, created by a token transfer and consumed by sendmsg
   // in the same transaction. Payer here is a fee payer, NOT a room role. Rows are
   // erased on use; reclaim refunds any row orphaned by an incomplete transaction flow.
   struct [[eosio::table]] pending {
      name payer;
      asset funds;
      uint64_t primary_key() const { return payer.value; }
   };
   using pending_t = multi_index<"pending"_n, pending>;

   [[eosio::action]] void setconfig(const config& cfg);
   [[eosio::action]] void setpaused(bool paused);
   [[eosio::on_notify("*::transfer")]]
   void ontransfer(name from, name to, asset quantity, string memo);
   [[eosio::action]] void reclaim(name payer);
   [[eosio::action]] void sendmsg(name sender, uint16_t parts, const vector<copy_t>& copies);
   // Standalone platform fee (key creation, key publishing, room listing/update/unlist). Consumes exactly
   // `fee` from the payer's same-transaction payment and splits it 80/20 with `memo` on both legs.
   // Any remainder stays pending for a following sendmsg in the same transaction (which refunds change);
   // nothing is stored about the payer, the memo or what the fee was for.
   [[eosio::action]] void payfee(name payer, asset fee, string memo);

   // ---- Sponsored (free) messages ----
   // Operator-funded budget, kept in its own singleton so the existing config row layout never changes.
   // sponsor_balance only grows from transfers by `funder` with SPONSOR_MEMO, so sponsored fees can never
   // spend a user's in-flight pending payment (zero custody of user funds is preserved).
   struct [[eosio::table]] budget {
      asset daily_limit = asset(2000000, symbol("CHEESE", 4)); // 200.0000 CHEESE per 24h window
      uint32_t window_start = 0;                                 // chain time (UTC seconds)
      asset spent = asset(0, symbol("CHEESE", 4));               // spent in the current window
      asset sponsor_balance = asset(0, symbol("CHEESE", 4));     // operator deposits not yet spent
      name funder;                                               // only account whose deposits fund sponsoring
      bool enabled = false;
   };
   using budget_singleton = singleton<"budget"_n, budget>;
   static constexpr const char* SPONSOR_MEMO = "CHEESECrypt sponsor deposit";

   // crypt.cheese@active only. Sets the daily cap, the switch and the funder account.
   [[eosio::action]] void setbudget(asset daily_limit, bool enabled, name funder);
   // crypt.cheese@active only. Returns unspent sponsor funds to the funder.
   [[eosio::action]] void takesponsor(asset quantity);
   // Free message: sender authorizes only this action (no token transfer). Same shape rules as sendmsg;
   // crypt.cheese pays the per-part platform fee 80/20 from sponsor_balance, within the daily cap.
   // Recipients are notified (require_recipient); no recipient dust is sent.
   [[eosio::action]] void sendfree(name sender, uint16_t parts, const vector<copy_t>& copies);

private:
   config get_config() const;
   void pay_platform(const config& cfg, const asset& amount, const string& memo);
   void send_token(const config& cfg, name to, const asset& qty, const string& memo);
   asset platform_fee(const config& cfg, uint16_t parts) const;
   std::vector<name> check_copies(const config& cfg, name sender, uint16_t parts, const vector<copy_t>& copies) const;
   budget get_budget() const;
};
