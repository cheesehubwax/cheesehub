#pragma once
// CHEESECrypt WAX contract. Mirrors the rules the web app currently enforces client-side
// (see contracts/cheesecrypt/APP_SYNC.md). Messages stay end-to-end encrypted: the contract
// never sees plaintext, it only routes paid encrypted copies, splits fees and stores room state.

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>
#include <eosio/system.hpp>
#include <eosio/crypto.hpp>
#include <string>
#include <vector>

using namespace eosio;
using std::string;
using std::vector;

class [[eosio::contract("cheesecrypt")]] cheesecrypt : public contract {
public:
   using contract::contract;

   // Message kinds; they decide the platform fee.
   static constexpr uint8_t KIND_TEXT    = 0; // text, replies, edits, group controls: text_fee per part
   static constexpr uint8_t KIND_NFT     = 1; // nft_fee on the first part, text_fee on the rest
   static constexpr uint8_t KIND_VOICE   = 2; // voice_fee once, whatever the part count

   static constexpr uint8_t ROLE_MEMBER = 0;
   static constexpr uint8_t ROLE_ADMIN  = 1;
   static constexpr uint8_t ROLE_OWNER  = 2;

   // One encrypted copy for one recipient. memo is the exact CRYPT1:/CG2 memo the app builds today.
   struct copy_t {
      name   to;
      string memo;
   };

   struct [[eosio::table]] config {
      name     token_contract    = "cheeseburger"_n;
      symbol   token_symbol      = symbol("CHEESE", 4);
      name     null_account      = "eosio.null"_n;
      name     liquidity_account = "xcheeseliqst"_n;
      asset    text_fee          = asset(100, symbol("CHEESE", 4));    // 0.0100 per part
      asset    nft_fee           = asset(200, symbol("CHEESE", 4));    // 0.0200 first part
      asset    voice_fee         = asset(10000, symbol("CHEESE", 4));  // 1.0000 once
      asset    recipient_fee     = asset(1, symbol("CHEESE", 4));      // 0.0001 per copy
      uint8_t  null_percent      = 80;                                 // rest goes to liquidity_account
      uint32_t private_cap       = 8;
      uint32_t public_cap        = 50;
      uint16_t max_parts         = 35;
      uint32_t edit_window_sec   = 24 * 3600;
      uint32_t receipt_keep_sec  = 72 * 3600;  // owner edit-log retention; receipts prunable after
      bool     paused            = false;
   };
   using config_singleton = singleton<"config"_n, config>;

   // Prepaid CHEESE per account (deposit by transferring CHEESE to this contract).
   struct [[eosio::table]] balance {
      name  owner;
      asset funds;
      uint64_t primary_key() const { return owner.value; }
   };
   using balances_t = multi_index<"balances"_n, balance>;

   struct [[eosio::table]] room {
      uint64_t       id;
      checksum256    group_hash;      // sha256 of the app's CG2 group id string
      string         group_id;
      name           owner;
      string         title;
      string         description;
      string         pub_key;         // CHEESECrypt public messaging key used for join requests
      bool           is_public = false;
      bool           ever_public = false; // set once; founders are frozen at that moment
      uint32_t       member_count = 0;
      time_point_sec created_at;
      time_point_sec first_public_at;
      uint64_t    primary_key() const { return id; }
      checksum256 by_group() const { return group_hash; }
      uint64_t    by_owner() const { return owner.value; }
   };
   using rooms_t = multi_index<"rooms"_n, room,
      indexed_by<"bygroup"_n, const_mem_fun<room, checksum256, &room::by_group>>,
      indexed_by<"byowner"_n, const_mem_fun<room, uint64_t, &room::by_owner>>>;

   // scope = room id
   struct [[eosio::table]] member {
      name           account;
      uint8_t        role = ROLE_MEMBER;
      bool           founder = false; // immutable after first public listing: ban- and admin-collapse-immune
      time_point_sec joined_at;
      uint64_t primary_key() const { return account.value; }
   };
   using members_t = multi_index<"members"_n, member>;

   // scope = room id
   struct [[eosio::table]] mute {
      name           account;
      name           muted_by;
      time_point_sec muted_at;
      time_point_sec muted_until;
      uint64_t primary_key() const { return account.value; }
   };
   using mutes_t = multi_index<"mutes"_n, mute>;

   // scope = room id
   struct [[eosio::table]] ban {
      name           account;
      name           banned_by;
      time_point_sec banned_at;
      uint64_t primary_key() const { return account.value; }
   };
   using bans_t = multi_index<"bans"_n, ban>;

   // scope = room id. Marks a message as collapsed; the chain copy itself can never be deleted.
   struct [[eosio::table]] collapsed {
      uint64_t       id;
      checksum256    digest;     // pre-edit message digest (or receipt digest)
      name           author;
      name           collapsed_by;
      time_point_sec collapsed_at;
      uint64_t    primary_key() const { return id; }
      checksum256 by_digest() const { return digest; }
   };
   using collapsed_t = multi_index<"collapsed"_n, collapsed,
      indexed_by<"bydigest"_n, const_mem_fun<collapsed, checksum256, &collapsed::by_digest>>>;

   // scope = sender. Lets edits be checked for author, room and 24h window. Prunable after receipt_keep_sec.
   struct [[eosio::table]] receipt {
      uint64_t       id;
      uint64_t       room_id;   // 0 = direct message / legacy group
      uint8_t        kind;
      time_point_sec sent_at;
      uint64_t primary_key() const { return id; }
   };
   using receipts_t = multi_index<"receipts"_n, receipt>;

   // ---- admin ----
   [[eosio::action]] void setconfig(const config& cfg);
   [[eosio::action]] void setpaused(bool paused);

   // ---- funds ----
   [[eosio::on_notify("*::transfer")]]
   void ontransfer(name from, name to, asset quantity, string memo);
   [[eosio::action]] void withdraw(name owner, asset quantity);

   // ---- messaging ----
   [[eosio::action]] void sendmsg(name sender, uint64_t room_id, uint8_t kind, uint16_t parts, const vector<copy_t>& copies);
   [[eosio::action]] void editmsg(name sender, uint64_t receipt_id, uint16_t parts, const vector<copy_t>& copies);
   [[eosio::action]] void prunercpts(name sender, uint32_t max_rows);
   [[eosio::action]] void msgreceipt(name sender, uint64_t receipt_id, uint64_t room_id, uint64_t edits); // inline log only

   // ---- rooms ----
   [[eosio::action]] void createroom(name owner, const string& group_id, const string& title);
   [[eosio::action]] void setpublic(name owner, uint64_t room_id, bool is_public, const string& title,
                                    const string& description, const string& pub_key);
   [[eosio::action]] void addmember(name owner, uint64_t room_id, name account);
   [[eosio::action]] void leave(name account, uint64_t room_id);

   // ---- moderation (public rooms) ----
   [[eosio::action]] void setadmin(name owner, uint64_t room_id, name account, bool on);
   [[eosio::action]] void muteuser(name actor, uint64_t room_id, name account, uint32_t duration_sec);
   [[eosio::action]] void unmuteuser(name actor, uint64_t room_id, name account);
   [[eosio::action]] void banuser(name owner, uint64_t room_id, name account);
   [[eosio::action]] void unbanuser(name owner, uint64_t room_id, name account);
   [[eosio::action]] void collapsemsg(name actor, uint64_t room_id, const checksum256& digest, name author);
   [[eosio::action]] void uncollapse(name actor, uint64_t room_id, const checksum256& digest);

private:
   config get_config() const;
   void   debit(name owner, const asset& amount);
   void   pay_platform(const config& cfg, const asset& amount, const string& memo);
   void   send_token(const config& cfg, name to, const asset& qty, const string& memo);
   asset  platform_fee(const config& cfg, uint8_t kind, uint16_t parts) const;
   void   deliver(const config& cfg, name sender, uint64_t room_id, uint8_t kind, uint16_t parts,
                  const vector<copy_t>& copies);
   room   get_room(uint64_t room_id) const;
   uint8_t live_role(uint64_t room_id, const room& r, name account) const; // muted admins act as members
   bool   is_muted(uint64_t room_id, name account) const;
};
