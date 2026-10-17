# Agent rules

- Token metadata snapshots share one versioned schema and public data URL across recorder and app; precisions are chain-verified, cached metadata contains no prices, and unknown live prices remain unknown so API outages cannot fabricate portfolio valuations.

- CHEESEAir preserves its React context identity in Vite hot data during Fast Refresh so mounted providers and updated cards share the same state.

- CHEESEAir LP holder token columns aggregate current underlying quantities in the selected pair's normalized token order, separate from USD payout weights, so presentation never changes distribution.

- CHEESEAir suffix snapshots read `eosio::newaccount` history from every Hyperion provider with a timestamp cursor (not skip) and union the results — providers index different slices of history and skip paging stops at 10,000 rows.

- CHEESEFolio data is client-only (IndexedDB per account) and always re-derived from saved raw transfers, so classifier changes never need a rescan; live balances are the truth, history only supplies cost.

- CHEESEFolio's acquisition breakdown uses cumulative trade receipts and ledger free receipts, explicitly separate from current holdings; it never alters cost basis or infers which source remains after disposals.

- CHEESEFolio scans always include the history provider reaching furthest back (probed per browser) and mark a sync complete only when that deepest provider was read to the end (shallower ones are cover, caught up next sync); big-page providers are read sequentially and only small-page ones are windowed, with capped concurrency — bursts make Hyperion nodes drop connections and stall the scan.

- CHEESEFolio de-duplicates by global sequence and drops inline transfer copies whose creator action is an identical transfer — some Hyperion nodes list the receiver notification as a separate action, which double-counts the movement.

- CHEESEFolio explains order-book fills from Alcor's per-account deal list (read in one large-limit request — its skip paging is gappy) and only looks up leftovers on Hyperion, routed by each provider's history start; per-transaction lookups alone take minutes on heavy accounts.

- CHEESEFolio holdings roll live pool positions (Alcor positions read per pool scope on chain, Taco/Defibox share tokens × reserves) into each token row; a venue that can't be read hides P/L for tokens history says are pooled, never counts as zero.

- Alcor's on-chain `positions` table is scoped per pool and indexed by owner (index 3); the farm manager's API fallback finds the account's pools from its `swap.alcor:addliquid` history, then sizes each position from the pool's current price.

- CHEESEFolio's history-gap warning trusts the deepest provider when its get_creator answer includes the creation transaction — an account's first transfer can come days after creation, which is idleness, not missing history.

- CHEESERam history before live sampling is rebuilt from Hyperion `eosio::rammarket` table deltas (exact Bancor state, EOSDAC nodes only) into the same 12h slots; backfill never alters an existing sample and leaves CHEESE fields null before CHEESE history exists (2024-01-28); from then each record takes its UTC day's CHEESE close from cheese-usd-history.json and live samples are never re-priced.

- CHEESECrypt keeps the original collection-manager wire formats (GPKM1:/GPKMKEY1: memos, gpk-msg-key files) so existing messages, published keys and backups stay readable.

- CHEESECrypt group envelopes live inside legacy pairwise encryption; immutable validated membership is discovered only after authenticated full assembly, and assembly isolates transactions/recipients before deduplicating sender fanout so separate copies cannot corrupt each other.

- CHEESECrypt avatars are validated palette-index data in optional key-file fields and separate per-account contact storage; imports rasterize locally, and on-chain key memos stay unchanged to preserve compatibility and avoid executable or remote avatar payloads.

- CHEESECrypt folder saving requests Desktop as the picker start and guides users to create/select its vault subfolder, not grant Desktop-root access, because Chromium can reject protected folders; permission errors keep the backup prompt retryable.
