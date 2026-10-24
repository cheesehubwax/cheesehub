#include "../include/cheesecrypt.hpp"

// ------------------------------------------------------------------ helpers

cheesecrypt::config cheesecrypt::get_config() const {
   config_singleton cs(get_self(), get_self().value);
   return cs.get_or_default(config{});
}

void cheesecrypt::debit(name owner, const asset& amount) {
   if (amount.amount == 0) return;
   balances_t bals(get_self(), get_self().value);
   auto it = bals.find(owner.value);
   check(it != bals.end(), "no CHEESE deposited: transfer CHEESE to this contract first");
   check(it->funds.symbol == amount.symbol, "symbol mismatch");
   check(it->funds.amount >= amount.amount, "insufficient deposited CHEESE, needed " + amount.to_string());
   if (it->funds.amount == amount.amount) bals.erase(it);
   else bals.modify(it, same_payer, [&](auto& b) { b.funds -= amount; });
}

void cheesecrypt::send_token(const config& cfg, name to, const asset& qty, const string& memo) {
   if (qty.amount == 0) return;
   action(permission_level{get_self(), "active"_n}, cfg.token_contract, "transfer"_n,
          std::make_tuple(get_self(), to, qty, memo)).send();
}

// Integer split: null share = floor(amount * null_percent / 100), the remainder to liquidity.
void cheesecrypt::pay_platform(const config& cfg, const asset& amount, const string& memo) {
   if (amount.amount == 0) return;
   const int64_t null_amt = (amount.amount * cfg.null_percent) / 100;
   send_token(cfg, cfg.null_account, asset(null_amt, amount.symbol), memo);
   send_token(cfg, cfg.liquidity_account, asset(amount.amount - null_amt, amount.symbol), memo);
}

asset cheesecrypt::platform_fee(const config& cfg, uint8_t kind, uint16_t parts) const {
   if (kind == KIND_VOICE) return cfg.voice_fee;
   if (kind == KIND_NFT) return cfg.nft_fee + cfg.text_fee * (parts - 1);
   check(kind == KIND_TEXT, "unknown message kind");
   return cfg.text_fee * parts;
}

cheesecrypt::room cheesecrypt::get_room(uint64_t room_id) const {
   rooms_t rooms(get_self(), get_self().value);
   return rooms.get(room_id, "room not found");
}

bool cheesecrypt::is_muted(uint64_t room_id, name account) const {
   mutes_t mutes(get_self(), room_id);
   auto it = mutes.find(account.value);
   return it != mutes.end() && it->muted_until > current_time_point();
}

uint8_t cheesecrypt::live_role(uint64_t room_id, const room& r, name account) const {
   if (account == r.owner) return ROLE_OWNER;
   members_t members(get_self(), room_id);
   auto it = members.find(account.value);
   if (it == members.end()) return ROLE_MEMBER;
   if (it->role == ROLE_ADMIN && r.is_public && !is_muted(room_id, account)) return ROLE_ADMIN;
   return ROLE_MEMBER;
}

void cheesecrypt::deliver(const config& cfg, name sender, uint64_t room_id, uint8_t kind, uint16_t parts,
                          const vector<copy_t>& copies) {
   check(!cfg.paused, "CHEESECrypt contract is paused");
   check(parts >= 1 && parts <= cfg.max_parts, "invalid part count");
   check(!copies.empty() && copies.size() % parts == 0, "copies must be recipients x parts");
   const uint64_t recipients = copies.size() / parts;

   if (room_id != 0) {
      const room r = get_room(room_id);
      members_t members(get_self(), room_id);
      check(members.find(sender.value) != members.end(), "sender is not a room member");
      check(!is_muted(room_id, sender), "sender is muted in this room");
      const uint32_t cap = r.is_public ? cfg.public_cap : cfg.private_cap;
      check(recipients < cap, "too many recipients for this room");
      for (const auto& c : copies)
         check(members.find(c.to.value) != members.end(), "recipient is not a room member: " + c.to.to_string());
   } else {
      check(recipients < cfg.public_cap, "too many recipients");
   }

   for (const auto& c : copies) {
      check(c.to != sender && c.to != get_self(), "invalid recipient");
      check(is_account(c.to), "recipient account does not exist");
      check(c.memo.size() <= 256, "memo longer than 256 bytes");
   }

   const asset fee = platform_fee(cfg, kind, parts);
   const asset total = fee + cfg.recipient_fee * static_cast<int64_t>(copies.size());
   debit(sender, total);
   pay_platform(cfg, fee, "CHEESECrypt fee");
   for (const auto& c : copies) send_token(cfg, c.to, cfg.recipient_fee, c.memo);
}

// ------------------------------------------------------------------ admin

void cheesecrypt::setconfig(const config& cfg) {
   require_auth(get_self());
   check(cfg.token_symbol.is_valid(), "invalid symbol");
   for (const asset* a : {&cfg.text_fee, &cfg.nft_fee, &cfg.voice_fee, &cfg.recipient_fee})
      check(a->symbol == cfg.token_symbol && a->amount >= 0, "fee symbol mismatch");
   check(cfg.recipient_fee.amount > 0, "recipient copies need a positive transfer");
   check(cfg.null_percent <= 100, "null_percent over 100");
   check(cfg.private_cap >= 2 && cfg.public_cap >= cfg.private_cap, "invalid caps");
   check(cfg.max_parts >= 1, "invalid max_parts");
   check(cfg.receipt_keep_sec >= cfg.edit_window_sec, "receipts must outlive the edit window");
   config_singleton cs(get_self(), get_self().value);
   cs.set(cfg, get_self());
}

void cheesecrypt::setpaused(bool paused) {
   require_auth(get_self());
   auto cfg = get_config();
   cfg.paused = paused;
   config_singleton cs(get_self(), get_self().value);
   cs.set(cfg, get_self());
}

// ------------------------------------------------------------------ funds

void cheesecrypt::ontransfer(name from, name to, asset quantity, string memo) {
   if (to != get_self() || from == get_self()) return;
   const auto cfg = get_config();
   check(get_first_receiver() == cfg.token_contract && quantity.symbol == cfg.token_symbol,
         "only CHEESE is accepted");
   check(quantity.amount > 0, "positive quantity required");
   balances_t bals(get_self(), get_self().value);
   auto it = bals.find(from.value);
   // The contract pays this row's RAM; deposits are expected to be small and frequently spent.
   if (it == bals.end()) bals.emplace(get_self(), [&](auto& b) { b.owner = from; b.funds = quantity; });
   else bals.modify(it, same_payer, [&](auto& b) { b.funds += quantity; });
}

void cheesecrypt::withdraw(name owner, asset quantity) {
   require_auth(owner);
   const auto cfg = get_config();
   check(quantity.symbol == cfg.token_symbol && quantity.amount > 0, "invalid quantity");
   debit(owner, quantity);
   send_token(cfg, owner, quantity, "CHEESECrypt withdrawal");
}

// ------------------------------------------------------------------ messaging

void cheesecrypt::sendmsg(name sender, uint64_t room_id, uint8_t kind, uint16_t parts, const vector<copy_t>& copies) {
   require_auth(sender);
   const auto cfg = get_config();
   deliver(cfg, sender, room_id, kind, parts, copies);

   receipts_t rc(get_self(), sender.value);
   const uint64_t id = rc.available_primary_key();
   rc.emplace(sender, [&](auto& r) { r.id = id; r.room_id = room_id; r.kind = kind; r.sent_at = current_time_point(); });
   action(permission_level{get_self(), "active"_n}, get_self(), "msgreceipt"_n,
          std::make_tuple(sender, id, room_id, uint64_t(0))).send();
}

void cheesecrypt::editmsg(name sender, uint64_t receipt_id, uint16_t parts, const vector<copy_t>& copies) {
   require_auth(sender);
   const auto cfg = get_config();
   receipts_t rc(get_self(), sender.value);
   const auto& r = rc.get(receipt_id, "original message receipt not found (only the author can edit)");
   check(current_time_point().sec_since_epoch() - r.sent_at.sec_since_epoch() <= cfg.edit_window_sec,
         "edit window has closed");
   deliver(cfg, sender, r.room_id, r.kind, parts, copies);
   action(permission_level{get_self(), "active"_n}, get_self(), "msgreceipt"_n,
          std::make_tuple(sender, receipt_id, r.room_id, uint64_t(1))).send();
}

void cheesecrypt::prunercpts(name sender, uint32_t max_rows) {
   // Anyone may prune expired receipts; RAM returns to the sender who paid for it.
   const auto cfg = get_config();
   receipts_t rc(get_self(), sender.value);
   const uint32_t now = current_time_point().sec_since_epoch();
   uint32_t n = 0;
   for (auto it = rc.begin(); it != rc.end() && n < max_rows;) {
      if (now - it->sent_at.sec_since_epoch() > cfg.receipt_keep_sec) { it = rc.erase(it); ++n; }
      else ++it;
   }
}

void cheesecrypt::msgreceipt(name sender, uint64_t receipt_id, uint64_t room_id, uint64_t edits) {
   require_auth(get_self());
   require_recipient(sender);
}

// ------------------------------------------------------------------ rooms

void cheesecrypt::createroom(name owner, const string& group_id, const string& title) {
   require_auth(owner);
   const auto cfg = get_config();
   check(!cfg.paused, "CHEESECrypt contract is paused");
   check(!group_id.empty() && group_id.size() <= 64, "invalid group id");
   check(title.size() <= 64, "title too long");
   rooms_t rooms(get_self(), get_self().value);
   const checksum256 h = sha256(group_id.data(), group_id.size());
   auto byg = rooms.get_index<"bygroup"_n>();
   check(byg.find(h) == byg.end(), "group id already registered");

   const uint64_t id = std::max<uint64_t>(1, rooms.available_primary_key());
   rooms.emplace(owner, [&](auto& r) {
      r.id = id; r.group_hash = h; r.group_id = group_id; r.owner = owner; r.title = title;
      r.member_count = 1; r.created_at = current_time_point();
   });
   members_t members(get_self(), id);
   members.emplace(owner, [&](auto& m) { m.account = owner; m.role = ROLE_OWNER; m.joined_at = current_time_point(); });
}

void cheesecrypt::setpublic(name owner, uint64_t room_id, bool is_public, const string& title,
                            const string& description, const string& pub_key) {
   require_auth(owner);
   const auto cfg = get_config();
   check(!cfg.paused, "CHEESECrypt contract is paused");
   rooms_t rooms(get_self(), get_self().value);
   const auto& r = rooms.get(room_id, "room not found");
   check(r.owner == owner, "only the room owner can list or unlist");
   check(title.size() <= 64 && description.size() <= 256 && pub_key.size() <= 128, "listing field too long");
   if (!is_public) check(r.member_count <= cfg.private_cap, "rooms above the private cap must stay public");
   if (is_public) check(!pub_key.empty(), "public messaging key required");

   const bool first = is_public && !r.ever_public;
   rooms.modify(r, same_payer, [&](auto& x) {
      x.is_public = is_public; x.title = title; x.description = description; x.pub_key = pub_key;
      if (first) { x.ever_public = true; x.first_public_at = current_time_point(); }
   });
   if (first) {
      // Freeze the founding roster exactly once; it can never be re-taken by relisting.
      members_t members(get_self(), room_id);
      for (auto it = members.begin(); it != members.end(); ++it)
         members.modify(it, same_payer, [&](auto& m) { m.founder = true; });
   }
   debit(owner, cfg.text_fee);
   pay_platform(cfg, cfg.text_fee, is_public ? "CHEESECrypt room listing" : "CHEESECrypt room unlisting");
}

void cheesecrypt::addmember(name owner, uint64_t room_id, name account) {
   require_auth(owner);
   const auto cfg = get_config();
   check(!cfg.paused, "CHEESECrypt contract is paused");
   rooms_t rooms(get_self(), get_self().value);
   const auto& r = rooms.get(room_id, "room not found");
   check(r.owner == owner, "only the room owner can admit members");
   check(is_account(account), "account does not exist");
   bans_t bans(get_self(), room_id);
   check(bans.find(account.value) == bans.end(), "account is banned from this room");
   members_t members(get_self(), room_id);
   check(members.find(account.value) == members.end(), "already a member");
   const uint32_t cap = r.is_public ? cfg.public_cap : cfg.private_cap;
   check(r.member_count < cap, r.is_public ? "public room is full"
                                           : "to grow beyond the private cap this room must be listed as a public room");
   members.emplace(owner, [&](auto& m) { m.account = account; m.joined_at = current_time_point(); });
   rooms.modify(r, same_payer, [&](auto& x) { x.member_count += 1; });
}

void cheesecrypt::leave(name account, uint64_t room_id) {
   require_auth(account);
   rooms_t rooms(get_self(), get_self().value);
   const auto& r = rooms.get(room_id, "room not found");
   check(r.owner != account, "the owner cannot leave their own room");
   members_t members(get_self(), room_id);
   const auto& m = members.get(account.value, "not a member");
   members.erase(m);
   rooms.modify(r, same_payer, [&](auto& x) { x.member_count -= 1; });
}

// ------------------------------------------------------------------ moderation

void cheesecrypt::setadmin(name owner, uint64_t room_id, name account, bool on) {
   require_auth(owner);
   const room r = get_room(room_id);
   check(r.owner == owner, "only the owner appoints admins");
   check(r.is_public, "admins exist only in public rooms");
   check(account != owner, "the owner is not an admin");
   members_t members(get_self(), room_id);
   const auto& m = members.get(account.value, "not a member");
   members.modify(m, same_payer, [&](auto& x) { x.role = on ? ROLE_ADMIN : ROLE_MEMBER; });
}

void cheesecrypt::muteuser(name actor, uint64_t room_id, name account, uint32_t duration_sec) {
   require_auth(actor);
   const room r = get_room(room_id);
   check(r.is_public, "moderation applies to public rooms");
   check(duration_sec == 900 || duration_sec == 3600 || duration_sec == 21600 || duration_sec == 86400,
         "mute must be 15m, 1h, 6h or 24h");
   const uint8_t role = live_role(room_id, r, actor);
   check(role == ROLE_OWNER || role == ROLE_ADMIN, "only the owner or an admin can mute");
   check(account != r.owner, "the owner cannot be muted");
   check(account != actor, "cannot mute yourself");
   members_t members(get_self(), room_id);
   check(members.find(account.value) != members.end(), "not a member");

   const time_point_sec now = current_time_point();
   const time_point_sec until = now + duration_sec;
   mutes_t mutes(get_self(), room_id);
   auto it = mutes.find(account.value);
   if (it == mutes.end())
      mutes.emplace(actor, [&](auto& x) { x.account = account; x.muted_by = actor; x.muted_at = now; x.muted_until = until; });
   else
      mutes.modify(it, same_payer, [&](auto& x) { x.muted_by = actor; x.muted_at = now; x.muted_until = until; });
}

void cheesecrypt::unmuteuser(name actor, uint64_t room_id, name account) {
   require_auth(actor);
   const room r = get_room(room_id);
   const uint8_t role = live_role(room_id, r, actor);
   check(role == ROLE_OWNER || role == ROLE_ADMIN, "only the owner or an admin can unmute");
   mutes_t mutes(get_self(), room_id);
   mutes.erase(mutes.get(account.value, "not muted"));
}

void cheesecrypt::banuser(name owner, uint64_t room_id, name account) {
   require_auth(owner);
   rooms_t rooms(get_self(), get_self().value);
   const auto& r = rooms.get(room_id, "room not found");
   check(r.owner == owner, "only the owner can ban");
   check(r.is_public, "bans apply to public rooms");
   check(account != owner, "cannot ban the owner");
   members_t members(get_self(), room_id);
   auto m = members.find(account.value);
   if (m != members.end()) {
      check(!m->founder, "founding members are ban-immune");
      members.erase(m); // also drops any admin role
      rooms.modify(r, same_payer, [&](auto& x) { x.member_count -= 1; });
   }
   bans_t bans(get_self(), room_id);
   check(bans.find(account.value) == bans.end(), "already banned");
   bans.emplace(owner, [&](auto& b) { b.account = account; b.banned_by = owner; b.banned_at = current_time_point(); });
}

void cheesecrypt::unbanuser(name owner, uint64_t room_id, name account) {
   require_auth(owner);
   const room r = get_room(room_id);
   check(r.owner == owner, "only the owner can unban");
   bans_t bans(get_self(), room_id);
   bans.erase(bans.get(account.value, "not banned"));
}

void cheesecrypt::collapsemsg(name actor, uint64_t room_id, const checksum256& digest, name author) {
   require_auth(actor);
   const room r = get_room(room_id);
   check(r.is_public, "collapsing applies to public rooms");
   const uint8_t role = live_role(room_id, r, actor);
   check(role == ROLE_OWNER || role == ROLE_ADMIN, "only the owner or an admin can collapse");
   if (role == ROLE_ADMIN) {
      check(author != r.owner, "admins cannot collapse the owner's messages");
      members_t members(get_self(), room_id);
      auto m = members.find(author.value);
      check(m == members.end() || !m->founder, "admins cannot collapse founding members' messages");
   }
   collapsed_t col(get_self(), room_id);
   auto byd = col.get_index<"bydigest"_n>();
   check(byd.find(digest) == byd.end(), "already collapsed");
   col.emplace(actor, [&](auto& c) {
      c.id = col.available_primary_key(); c.digest = digest; c.author = author;
      c.collapsed_by = actor; c.collapsed_at = current_time_point();
   });
}

void cheesecrypt::uncollapse(name actor, uint64_t room_id, const checksum256& digest) {
   require_auth(actor);
   const room r = get_room(room_id);
   const uint8_t role = live_role(room_id, r, actor);
   check(role == ROLE_OWNER || role == ROLE_ADMIN, "only the owner or an admin can restore");
   collapsed_t col(get_self(), room_id);
   auto byd = col.get_index<"bydigest"_n>();
   auto it = byd.find(digest);
   check(it != byd.end(), "not collapsed");
   if (role == ROLE_ADMIN) {
      check(it->author != r.owner, "admins cannot act on the owner's messages");
      members_t members(get_self(), room_id);
      auto m = members.find(it->author.value);
      check(m == members.end() || !m->founder, "admins cannot act on founding members' messages");
   }
   byd.erase(it);
}
