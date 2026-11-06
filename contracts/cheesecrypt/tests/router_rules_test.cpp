#include "../include/router_rules.hpp"
#include <cassert>
#include <iostream>

int main() {
   using namespace crypt_router;
   // One uniform 0.0100 CHEESE price per part for every message type.
   assert(platform_units(3, 100) == 300);
   assert(platform_units(1, 100) + 1 == 101);
   assert(platform_units(30, 100) == 3000); // 0.3000 voice batch platform fee
   assert(platform_units(30, 100) + 30 == 3030); // 0.3030 with one recipient
   assert(platform_units(30, 100) + 30 * 2 == 3060); // shared, not doubled
   const int64_t platform = platform_units(35, 100);
   assert(platform + 35 * 49 == 5215); // one shared fee + 0.0001 per copy
   assert(null_units(100, 80) == 80);
   assert(100 - null_units(100, 80) == 20);
   assert(null_units(101, 80) == 80 && 101 - null_units(101, 80) == 21);
   assert(batch_shape(35, 35 * 49, 35, 49));
   assert(!batch_shape(36, 36 * 49, 35, 49));
   assert(!batch_shape(35, 35 * 50, 35, 49));
   assert(!batch_shape(0, 0, 35, 49));
   assert(!batch_shape(2, 3, 35, 49));
   assert(!batch_shape(1, 1, 36, 49));
   assert(!batch_shape(1, 1, 35, 50));
   assert(platform_units(0, 100) == -1);
   assert(platform_units(36, 100) == -1);
   assert(!valid_fee(MAX_FEE_UNITS + 1) && !valid_fee(-1));
   assert(platform_units(35, MAX_FEE_UNITS) == 3500000000LL);
   assert(null_units(3500000000LL, 80) == 2800000000LL);
   // Standalone fees: 100.0000 CHEESE key creation/listing and 0.0100 CHEESE publish/update/unlist.
   assert(valid_standalone_fee(1000000) && null_units(1000000, 80) == 800000);
   assert(valid_standalone_fee(100) && null_units(100, 80) == 80);
   assert(!valid_standalone_fee(0) && !valid_standalone_fee(-5) && !valid_standalone_fee(101));
   assert(!valid_standalone_fee(MAX_FEE_UNITS + 5));
   // Sponsored budget: fixed 24h windows on chain time; 200.0000 CHEESE = 2000000 units.
   assert(window_start_at(1000, 0) == 1000);                 // first use opens a window
   assert(window_start_at(1000 + 86399, 1000) == 1000);      // same window one second before rollover
   assert(window_start_at(1000 + 86400, 1000) == 87400);     // new window after a full day
   assert(window_start_at(500, 1000) == 1000);               // an earlier clock never opens a window
   assert(sponsor_allows(0, 100, 2000000, 5000000));
   assert(sponsor_allows(1999900, 100, 2000000, 5000000));   // exactly reaches the cap
   assert(!sponsor_allows(1999901, 100, 2000000, 5000000));  // would exceed 200 CHEESE
   assert(!sponsor_allows(0, 100, 2000000, 99));             // sponsor balance too small
   assert(!sponsor_allows(0, 0, 2000000, 5000000) && !sponsor_allows(-1, 100, 2000000, 5000000));
   assert(!sponsor_allows(2000001, 100, 2000000, 5000000));
   assert(platform_units(1, 100) == 100 && null_units(100, 80) == 80); // sponsored 1 part: 0.0080 nulled, 0.0020 liquidity
   std::cout << "Router fee and bound tests passed\n";
}
