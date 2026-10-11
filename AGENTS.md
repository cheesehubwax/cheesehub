# Agent rules

- CHEESEAir LP holder token columns aggregate current underlying quantities in the selected pair's normalized token order, separate from USD payout weights, so presentation never changes distribution.

- CHEESEAir suffix snapshots read `eosio::newaccount` history from every Hyperion provider with a timestamp cursor (not skip) and union the results — providers index different slices of history and skip paging stops at 10,000 rows.
