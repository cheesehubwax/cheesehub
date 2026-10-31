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
   std::cout << "Router fee and bound tests passed\n";
}
