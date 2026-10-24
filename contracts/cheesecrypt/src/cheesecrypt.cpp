#include "../include/cheesecrypt.hpp"
#include <map>

cheesecrypt::config cheesecrypt::get_config() const {
   config_singleton cs(get_self(), get_self().value);
   return cs.get_or_default(config{});
}

void cheesecrypt::debit(name owner, const asset& amount) {
   balances_t bals(get_self(), get_self().value);
   auto it = bals.find(owner.value);
   check(it != bals.end(), "deposit CHEESE to this contract first");
   check(it->funds.symbol == amount.symbol, "symbol mismatch");
   check(amount.amount > 0 && it->funds.amount >= amount.amount, "insufficient deposited CHEESE");
   if (it->funds.amount == amount.amount) bals.erase(it);
   else bals.modify(it, same_payer, [&](auto& b) { b.funds -= amount; });
}

void cheesecrypt::send_token(const config& cfg, name to, const asset& qty, const string& memo) {
   if (qty.amount == 0) return;
   action(permission_level{get_self(), "active"_n}, cfg.token_contract, "transfer"_n,
          std::make_tuple(get_self(), to, qty, memo)).send();
}

void cheesecrypt::pay_platform(const config& cfg, const asset& amount) {
   const int64_t nulled = crypt_router::null_units(amount.amount, cfg.null_percent);
   check(nulled >= 0, "invalid platform split");
   send_token(cfg, cfg.null_account, asset(nulled, amount.symbol), "CHEESECrypt messaging fee");
   send_token(cfg, cfg.liquidity_account, asset(amount.amount - nulled, amount.symbol), "CHEESECrypt messaging fee");
}

asset cheesecrypt::platform_fee(const config& cfg, uint8_t kind, uint16_t parts) const {
   const int64_t units = crypt_router::platform_units(kind, parts, cfg.text_fee.amount, cfg.nft_fee.amount, cfg.voice_fee.amount);
   check(units >= 0, "invalid message kind, fee or parts");
   return asset(units, cfg.token_symbol);
}

void cheesecrypt::setconfig(const config& cfg) {
   require_auth(get_self());
   check(cfg.token_symbol.is_valid(), "invalid symbol");
   check(is_account(cfg.token_contract) && cfg.token_contract != get_self(), "invalid token contract");
   check(is_account(cfg.null_account) && is_account(cfg.liquidity_account), "fee account does not exist");
   check(cfg.null_account != get_self() && cfg.liquidity_account != get_self() &&
         cfg.null_account != cfg.liquidity_account, "fee accounts must be distinct and external");
   for (const asset* a : {&cfg.text_fee, &cfg.nft_fee, &cfg.voice_fee, &cfg.recipient_fee})
      check(a->is_valid() && a->symbol == cfg.token_symbol && crypt_router::valid_fee(a->amount), "invalid fee");
   check(cfg.recipient_fee.amount > 0, "copies need a positive transfer");
   check(cfg.null_percent == 80, "platform split must stay 80/20");
   check(crypt_router::valid_limits(cfg.max_parts, cfg.max_recipients), "limits exceed hard bounds");
   const auto old = get_config();
   if (old.token_contract != cfg.token_contract || old.token_symbol != cfg.token_symbol) {
      balances_t bals(get_self(), get_self().value);
      check(bals.begin() == bals.end(), "withdraw all balances before changing token denomination");
   }
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

void cheesecrypt::ontransfer(name from, name to, asset quantity, string memo) {
   if (to != get_self() || from == get_self()) return;
   const auto cfg = get_config();
   check(!cfg.paused, "deposits are paused; withdrawals remain available");
   check(get_first_receiver() == cfg.token_contract && quantity.symbol == cfg.token_symbol,
         "only the configured CHEESE token is accepted");
   check(quantity.is_valid() && quantity.amount > 0, "positive valid quantity required");
   // Do not let a third party create deposit rows at the router's RAM expense.
   require_auth(from);
   balances_t bals(get_self(), get_self().value);
   auto it = bals.find(from.value);
   if (it == bals.end()) bals.emplace(from, [&](auto& b) { b.owner = from; b.funds = quantity; });
   else bals.modify(it, same_payer, [&](auto& b) { b.funds += quantity; });
}

void cheesecrypt::withdraw(name owner, asset quantity) {
   require_auth(owner);
   const auto cfg = get_config();
   check(quantity.is_valid() && quantity.symbol == cfg.token_symbol && quantity.amount > 0, "invalid quantity");
   debit(owner, quantity);
   send_token(cfg, owner, quantity, "CHEESECrypt withdrawal");
}

void cheesecrypt::sendmsg(name sender, uint8_t kind, uint16_t parts, const vector<copy_t>& copies) {
   require_auth(sender);
   const auto cfg = get_config();
   check(!cfg.paused, "CHEESECrypt contract is paused");
   check(crypt_router::batch_shape(parts, copies.size(), cfg.max_parts, cfg.max_recipients),
         "invalid parts or copies (maximum 35 parts and 49 recipients)");
   std::map<uint64_t, uint16_t> counts;
   for (const auto& c : copies) {
      check(c.to != sender && c.to != get_self(), "invalid recipient");
      check(is_account(c.to), "recipient does not exist");
      check(!c.memo.empty() && c.memo.size() <= 256, "memo must be 1 to 256 bytes");
      auto& count = counts[c.to.value];
      ++count;
      check(count <= parts, "too many copies for one recipient");
   }
   check(counts.size() <= cfg.max_recipients, "too many distinct recipients");
   for (const auto& count : counts) check(count.second == parts, "each recipient must receive exactly parts copies");
   // Inputs and config are bounded before arithmetic, including the total and integer split.
   const asset fee = platform_fee(cfg, kind, parts);
   check(crypt_router::valid_fee(cfg.recipient_fee.amount) && cfg.recipient_fee.amount > 0, "invalid recipient fee");
   const asset total = fee + cfg.recipient_fee * static_cast<int64_t>(copies.size());
   debit(sender, total);
   pay_platform(cfg, fee);
   for (const auto& c : copies) send_token(cfg, c.to, cfg.recipient_fee, c.memo);
   // Any failed inline transfer rolls the entire action and debit back atomically.
}
