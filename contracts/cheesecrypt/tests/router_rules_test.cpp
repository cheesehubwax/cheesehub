#include "../include/router_rules.hpp"
#include <cassert>
#include <iostream>

int main() {
   using namespace crypt_router;
   // Existing prices in four-decimal CHEESE units, one test per price rule.
   assert(platform_units(0, 3, 100, 200, 10000) == 300);
   assert(platform_units(1, 3, 100, 200, 10000) == 400);
   assert(platform_units(2, 30, 100, 200, 10000) == 10000);
   assert(platform_units(0, 1, 100, 200, 10000) + 1 == 101);
   const int64_t platform = platform_units(0, 35, 100, 200, 10000);
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
   assert(platform_units(3, 1, 100, 200, 10000) == -1);
   assert(platform_units(1, 0, 100, 200, 10000) == -1);
   assert(!valid_fee(MAX_FEE_UNITS + 1) && !valid_fee(-1));
   assert(platform_units(0, 35, MAX_FEE_UNITS, MAX_FEE_UNITS, MAX_FEE_UNITS) == 3500000000LL);
   assert(null_units(3500000000LL, 80) == 2800000000LL);
   std::cout << "Router fee and bound tests passed\n";
}