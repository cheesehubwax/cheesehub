# Agent rules

- CHEESEAir preserves its React context identity in Vite hot data during Fast Refresh so mounted providers and updated cards share the same state.

- CHEESEAir LP holder token columns aggregate current underlying quantities in the selected pair's normalized token order, separate from USD payout weights, so presentation never changes distribution.

- CHEESEAir suffix snapshots read `eosio::newaccount` history from every Hyperion provider with a timestamp cursor (not skip) and union the results — providers index different slices of history and skip paging stops at 10,000 rows.
