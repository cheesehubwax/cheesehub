# Agent rules

- CHEESEAir suffix snapshots read `eosio::newaccount` history from every Hyperion provider with a timestamp cursor (not skip) and union the results — providers index different slices of history and skip paging stops at 10,000 rows.
