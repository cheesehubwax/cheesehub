# Agent rules

- Token metadata snapshots share one versioned schema and public data URL across recorder and app; precisions are chain-verified, cached metadata contains no prices, and unknown live prices remain unknown so API outages cannot fabricate portfolio valuations.

- CHEESEAir keeps context identity in Vite hot data so providers/cards share state.

- CHEESEAir LP token columns aggregate current underlying quantities in normalized pair order, separate from USD payout weights so presentation never changes distribution.

- CHEESEAir suffix snapshots union every Hyperion provider's `eosio::newaccount` history using timestamp cursors, never skip: providers cover different slices and skip stops at 10,000 rows.

- CHEESEFolio is client-only (IndexedDB per account), re-derived from saved raw transfers so classifier changes need no rescan; live balances are truth, history supplies cost.

- CHEESEFolio's acquisition breakdown uses cumulative trade receipts and ledger free receipts, explicitly separate from current holdings; it never alters cost basis or infers which source remains after disposals.

- CHEESEFolio scans always include the history provider reaching furthest back (probed per browser) and mark a sync complete only when that deepest provider was read to the end (shallower ones are cover, caught up next sync); big-page providers are read sequentially and only small-page ones are windowed, with capped concurrency — bursts make Hyperion nodes drop connections and stall the scan.

- CHEESEFolio de-duplicates by global sequence and drops inline transfer copies whose creator action is an identical transfer — some Hyperion nodes list the receiver notification as a separate action, which double-counts the movement.

- CHEESEFolio explains order-book fills from Alcor's per-account deal list (read in one large-limit request — its skip paging is gappy) and only looks up leftovers on Hyperion, routed by each provider's history start; per-transaction lookups alone take minutes on heavy accounts.

- CHEESEFolio holdings roll live pool positions (Alcor positions read per pool scope on chain, Taco/Defibox share tokens × reserves) into each token row; a venue that can't be read hides P/L for tokens history says are pooled, never counts as zero.

- Alcor's on-chain `positions` table is scoped per pool and indexed by owner (index 3); the farm manager's API fallback finds the account's pools from its `swap.alcor:addliquid` history, then sizes each position from the pool's current price.

- CHEESEFolio's history-gap warning trusts the deepest provider when its get_creator answer includes the creation transaction — an account's first transfer can come days after creation, which is idleness, not missing history.

- CHEESERam history before live sampling is rebuilt from Hyperion `eosio::rammarket` table deltas (exact Bancor state, EOSDAC nodes only) into the same 12h slots; backfill never alters an existing sample and leaves CHEESE fields null before CHEESE history exists (2024-01-28); from then each record takes its UTC day's CHEESE close from cheese-usd-history.json and live samples are never re-priced.

- Crypt writes CRYPT1:/CRYPTKEY1:, reads legacy GPKM1:/GPKMKEY1: and keeps gpk-msg-key files for compatibility.
- CHEESECrypt voice notes are 0x03-headed byte memos assembled by sender+recipient+id across 30-part transactions; play only when complete and digest-verified (batches can partly fail).
- CHEESECrypt names are validated optional key-file metadata, separate from per-owner nicknames; WAX accounts remain delivery identities. Friend removal clears contact metadata and excludes rediscovery until explicit re-add, preserving history and groups.

- Crypt About uses DappAbout and a separate cryptography dialog.

- CHEESECrypt group envelopes use legacy pairwise encryption; discover immutable membership only after authenticated assembly, isolating transactions/recipients before deduplicating fanout. Per-owner hidden-group IDs affect visibility only, preserving definitions/history for restoration.

- Crypt uses integer fee splits and explicit fee omission for fanout; never filter action indexes. Confirm payment before local key creation; imports stay free. History uses current rates.

- CHEESECrypt avatars are validated palette-index data in optional key-file fields and separate per-account contact storage; imports rasterize locally, and on-chain key memos stay unchanged to preserve compatibility and avoid executable or remote avatar payloads.

- CHEESECrypt folder pickers start at Desktop but request the vault subfolder; retry permission failures because Chromium protects Desktop-root access. Profile precedes keys; edits refresh only verified matching-key backups (staged writes), else download.

- CHEESECrypt shares one vault folder per device; `friends/` files load into every account (nicknames/removals per account); only explicit saves replace friend files.

- Both NFT players normalize media via nftMedia (case-insensitive audio/clip/video, reference-only sound/mp3/sfx aliases); version music caches on detection changes to avoid stale classifications.
