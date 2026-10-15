# Agent rules

- CHEESEAir preserves its React context identity in Vite hot data during Fast Refresh so mounted providers and updated cards share the same state.

- CHEESEAir LP holder token columns aggregate current underlying quantities in the selected pair's normalized token order, separate from USD payout weights, so presentation never changes distribution.

- CHEESEAir suffix snapshots read `eosio::newaccount` history from every Hyperion provider with a timestamp cursor (not skip) and union the results — providers index different slices of history and skip paging stops at 10,000 rows.

- CHEESEFolio data is client-only (IndexedDB per account) and always re-derived from saved raw transfers, so classifier changes never need a rescan; live balances are the truth, history only supplies cost.

- CHEESEFolio scans always include the history provider reaching furthest back (probed per browser) and only mark a sync complete when every chosen provider finished — partial history silently produces wrong profit/loss.

- CHEESEFolio de-duplicates by global sequence and drops inline transfer copies whose creator action is an identical transfer — some Hyperion nodes list the receiver notification as a separate action, which double-counts the movement.

- CHEESEFolio explains order-book fills from Alcor's per-account deal list (read in one large-limit request — its skip paging is gappy) and only looks up leftovers on Hyperion, routed by each provider's history start; per-transaction lookups alone take minutes on heavy accounts.
