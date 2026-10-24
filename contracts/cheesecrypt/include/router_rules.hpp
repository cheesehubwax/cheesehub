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
inline int64_t platform_units(uint8_t kind, uint16_t parts, int64_t text, int64_t nft, int64_t voice) {
   if (parts < 1 || parts > HARD_MAX_PARTS || !valid_fee(text) || !valid_fee(nft) || !valid_fee(voice)) return -1;
   if (kind == 0) return text * parts;
   if (kind == 1) return nft + text * (parts - 1);
   if (kind == 2) return voice;
   return -1;
}
inline int64_t null_units(int64_t platform, uint8_t percent) {
   if (platform < 0 || platform > MAX_FEE_UNITS * HARD_MAX_PARTS || percent > 100) return -1;
   return platform * percent / 100;
}
} // namespace crypt_router