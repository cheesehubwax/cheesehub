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
   static constexpr uint8_t KIND_TEXT = 0;
   static constexpr uint8_t KIND_NFT = 1;
   static constexpr uint8_t KIND_VOICE = 2;

   struct copy_t {
      name to;
      string memo; // Opaque original encrypted memo. Sender attribution is in sendmsg.
   };

   struct [[eosio::table]] config {
      name token_contract = "cheeseburger"_n;
      symbol token_symbol = symbol("CHEESE", 4);
      name null_account = "eosio.null"_n;
      name liquidity_account = "xcheeseliqst"_n;
      asset text_fee = asset(100, symbol("CHEESE", 4));
      asset nft_fee = asset(200, symbol("CHEESE", 4));
      asset voice_fee = asset(10000, symbol("CHEESE", 4));
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
   [[eosio::action]] void sendmsg(name sender, uint8_t kind, uint16_t parts, const vector<copy_t>& copies);

private:
   config get_config() const;
   void pay_platform(const config& cfg, const asset& amount);
   void send_token(const config& cfg, name to, const asset& qty, const string& memo);
   asset platform_fee(const config& cfg, uint8_t kind, uint16_t parts) const;
};
