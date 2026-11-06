#pragma once
#include <cstdint>

// Pure bounded arithmetic shared with native tests. Values are token smallest units.
namespace crypt_router {
constexpr uint16_t HARD_MAX_PARTS = 35;
constexpr uint32_t HARD_MAX_RECIPIENTS = 49;
constexpr int64_t MAX_FEE_UNITS = 100000000; // arithmetic ceiling, not a default price

inline bool valid_fee(int64_t value) { return value >= 0 && value <= MAX_FEE_UNITS; }
inline bool valid_limits(uint16_t parts, uint32_t recipients) {
   return parts >= 1 && parts <= HARD_MAX_PARTS && recipients >= 1 && recipients <= HARD_MAX_RECIPIENTS;
}
inline bool batch_shape(uint16_t parts, uint64_t copies, uint16_t max_parts, uint32_t max_recipients) {
   return valid_limits(max_parts, max_recipients) && parts >= 1 && parts <= max_parts &&
          copies > 0 && copies <= uint64_t(parts) * max_recipients && copies % parts == 0;
}
// One uniform price per part: the router never learns or reveals what a message contains.
inline int64_t platform_units(uint16_t parts, int64_t part_fee) {
   if (parts < 1 || parts > HARD_MAX_PARTS || !valid_fee(part_fee)) return -1;
   return part_fee * parts;
}
inline int64_t null_units(int64_t platform, uint8_t percent) {
   if (platform < 0 || platform > MAX_FEE_UNITS * HARD_MAX_PARTS || percent > 100) return -1;
   return platform * percent / 100;
}
// Standalone fees (key creation/publishing, room listings) are paid whole: positive, within the arithmetic
// ceiling and a multiple of 5 units so the 80/20 split is exact with no rounding.
inline bool valid_standalone_fee(int64_t value) { return value > 0 && valid_fee(value) && value % 5 == 0; }
// Sponsored (free) messages: crypt.cheese pays from an operator-funded sponsor balance, capped per fixed
// 24-hour window. Window time is chain consensus time; callers cannot supply or move it.
constexpr uint32_t SPONSOR_WINDOW_SEC = 86400;
// Start of the window that applies at `now`: a fresh window opens once a full day has passed since `start`
// (or on first use). A clock earlier than `start` never opens a new window.
inline uint32_t window_start_at(uint32_t now, uint32_t start) {
   if (start == 0) return now;
   if (now < start) return start;
   return (now - start >= SPONSOR_WINDOW_SEC) ? now : start;
}
// True only when `fee` fits both the remaining daily limit and the sponsor balance, with no overflow.
inline bool sponsor_allows(int64_t spent, int64_t fee, int64_t daily_limit, int64_t sponsor_balance) {
   if (fee <= 0 || spent < 0 || daily_limit < 0 || sponsor_balance < 0 || spent > daily_limit) return false;
   return fee <= daily_limit - spent && fee <= sponsor_balance;
}
} // namespace crypt_router