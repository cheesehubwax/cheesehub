#include "../include/cheesecrypt.hpp"
#include <map>

cheesecrypt::config cheesecrypt::get_config() const {
   config_singleton cs(get_self(), get_self().value);
   return cs.get_or_default(config{});
}

void cheesecrypt::send_token(const config& cfg, name to, const asset& qty, const string& memo) {
   if (qty.amount == 0) return;
   action(permission_level{get_self(), "active"_n}, cfg.token_contract, "transfer"_n,
          std::make_tuple(get_self(), to, qty, memo)).send();
}

void cheesecrypt::pay_platform(const config& cfg, const asset& amount, const string& memo) {
   const int64_t nulled = crypt_router::null_units(amount.amount, cfg.null_percent);
   check(nulled >= 0, "invalid platform split");
   send_token(cfg, cfg.null_account, asset(nulled, amount.symbol), memo);
   send_token(cfg, cfg.liquidity_account, asset(amount.amount - nulled, amount.symbol), memo);
}

asset cheesecrypt::platform_fee(const config& cfg, uint16_t parts) const {
   const int64_t units = crypt_router::platform_units(parts, cfg.part_fee.amount);
   check(units >= 0, "invalid fee or parts");
   return asset(units, cfg.token_symbol);
}

void cheesecrypt::setconfig(const config& cfg) {
   require_auth(get_self());
   check(cfg.token_symbol.is_valid(), "invalid symbol");
   check(is_account(cfg.token_contract) && cfg.token_contract != get_self(), "invalid token contract");
   check(is_account(cfg.null_account) && is_account(cfg.liquidity_account), "fee account does not exist");
   check(cfg.null_account != get_self() && cfg.liquidity_account != get_self() &&
         cfg.null_account != cfg.liquidity_account, "fee accounts must be distinct and external");
   for (const asset* a : {&cfg.part_fee, &cfg.recipient_fee})
      check(a->is_valid() && a->symbol == cfg.token_symbol && crypt_router::valid_fee(a->amount), "invalid fee");
   check(cfg.recipient_fee.amount > 0, "copies need a positive transfer");
   check(cfg.null_percent == 80, "platform split must stay 80/20");
   check(crypt_router::valid_limits(cfg.max_parts, cfg.max_recipients), "limits exceed hard bounds");
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
   check(!cfg.paused, "CHEESECrypt contract is paused");
   check(get_first_receiver() == cfg.token_contract && quantity.symbol == cfg.token_symbol,
         "only the configured CHEESE token is accepted");
   check(quantity.is_valid() && quantity.amount > 0, "positive valid quantity required");
   // Only the payer's own signed transfer may open a pending row. WAX forbids billing
   // another account's RAM inside a notification, so the router pays the row's RAM;
   // sendmsg/reclaim erase it, so normal sends use no net router RAM.
   require_auth(from);
   pending_t pend(get_self(), get_self().value);
   auto it = pend.find(from.value);
   if (it == pend.end()) pend.emplace(get_self(), [&](auto& p) { p.payer = from; p.funds = quantity; });
   else pend.modify(it, same_payer, [&](auto& p) { p.funds += quantity; });
}

void cheesecrypt::reclaim(name payer) {
   require_auth(payer);
   const auto cfg = get_config();
   pending_t pend(get_self(), get_self().value);
   auto it = pend.find(payer.value);
   check(it != pend.end(), "no pending payment to reclaim");
   const asset refund = it->funds;
   pend.erase(it);
   send_token(cfg, payer, refund, "CHEESECrypt payment reclaim");
}

void cheesecrypt::sendmsg(name sender, uint16_t parts, const vector<copy_t>& copies) {
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
   const asset fee = platform_fee(cfg, parts);
   check(crypt_router::valid_fee(cfg.recipient_fee.amount) && cfg.recipient_fee.amount > 0, "invalid recipient fee");
   const asset total = fee + cfg.recipient_fee * static_cast<int64_t>(copies.size());
   // Consume this sender's in-flight payment from the same transaction; zero custody.
   pending_t pend(get_self(), get_self().value);
   auto it = pend.find(sender.value);
   check(it != pend.end(), "pay the exact fee to this contract in the same transaction");
   check(it->funds.symbol == total.symbol, "symbol mismatch");
   check(it->funds.amount >= total.amount, "payment does not cover the message fee");
   const int64_t change = it->funds.amount - total.amount;
   pend.erase(it);
   pay_platform(cfg, fee, "CHEESECrypt messaging fee");
   for (const auto& c : copies) send_token(cfg, c.to, cfg.recipient_fee, c.memo);
   send_token(cfg, sender, asset(change, total.symbol), "CHEESECrypt change");
   // Any failed inline transfer rolls the entire transaction back atomically, including
   // the sender's payment, so the router never holds funds between transactions.
}

void cheesecrypt::payfee(name payer, asset fee, string memo) {
   require_auth(payer);
   const auto cfg = get_config();
   check(!cfg.paused, "CHEESECrypt contract is paused");
   check(fee.is_valid() && fee.symbol == cfg.token_symbol, "fee must be the configured CHEESE token");
   check(crypt_router::valid_standalone_fee(fee.amount), "fee must be positive, bounded and split exactly 80/20");
   check(!memo.empty() && memo.size() <= 256, "memo must be 1 to 256 bytes");
   pending_t pend(get_self(), get_self().value);
   auto it = pend.find(payer.value);
   check(it != pend.end(), "pay the fee to this contract in the same transaction");
   check(it->funds.symbol == fee.symbol, "symbol mismatch");
   check(it->funds.amount >= fee.amount, "payment does not cover the fee");
   // Consume exactly the fee. A remainder only exists when a sendmsg follows in this same transaction
   // (it consumes the rest and refunds change); otherwise the client pays the exact fee and the row is erased.
   if (it->funds.amount == fee.amount) pend.erase(it);
   else pend.modify(it, same_payer, [&](auto& p) { p.funds -= fee; });
   pay_platform(cfg, fee, memo);
}
