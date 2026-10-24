# Agent rules

- CHEESECrypt private invites retain their original wire cap; public admissions use bounded complete multipart bootstraps for newcomers and owner-authenticated roster-digest predecessor deltas for existing members in one atomic transaction, preserving pairwise keys and first-public protection.

- CHEESECrypt public-room moderation uses authenticated encrypted CG2 controls (owner, plus owner-appointed admins for mutes/collapses, authority replayed in chain order) and an immutable first-public protected roster; encrypted controls are retained per account and re-derived before edits/unread/rendering. Bans exclude future recipient copies, never revoke held keys, while mute intervals permanently suppress traffic and quotes sent within them. Collapses target the pre-edit message digest and only mark rows, since chain copies cannot be deleted. All of this is a client-side stand-in until the CHEESECrypt contract enforces it.

- CHEESECrypt edits resolve authenticated followups against an unambiguous content-and-transaction digest within the same sender/conversation; preserve original row identity/time and apply only complete in-window replacements. Voice edits use a flagged extra target part; owner logs derive from decrypted history only for currently public owned rooms, never central storage.

- CHEESECrypt's orb has an intentionally source-controlled public image copy for external production hosting; preview uses its asset pointer because GitHub Pages cannot serve Lovable-relative asset paths.

- Token metadata snapshots share one versioned schema and public data URL across recorder and app; precisions are chain-verified, cached metadata contains no prices, and unknown live prices remain unknown so API outages cannot fabricate portfolio valuations.
- CHEESEAir keeps context identity in Vite hot data so providers/cards share state.
- CHEESEAir LP token columns aggregate current underlying quantities in normalized pair order, separate from USD payout weights so presentation never changes distribution.
- CHEESEAir suffix unions use timestamp cursors, bounded reads and complete-only cache; stalled providers flag partial results because indexes differ and skip stops at 10,000 rows.
- CHEESEFolio re-derives raw IndexedDB history per account; live balances are truth. Shared prices poll foreground-only/refetch on focus; metadata/placeholders never get live timestamps.
- Folio acquisitions use cumulative trade/free receipts, separate from holdings; never alter basis or infer sources after disposals.
- CHEESEFolio scans always include the history provider reaching furthest back and complete a sync only when it was read to the end; big-page providers read sequentially, only small-page ones windowed, capped concurrency — bursts make Hyperion drop connections.
- CHEESEFolio de-duplicates by global sequence and drops inline copies with identical transfer creator actions; Hyperion receiver notifications otherwise double-count movements.
- CHEESEFolio explains order-book fills from Alcor's per-account deal list (read in one large-limit request — its skip paging is gappy) and only looks up leftovers on Hyperion, routed by each provider's history start; per-transaction lookups alone take minutes on heavy accounts.
- CHEESEFolio holdings roll live pool positions (Alcor positions read per pool scope on chain, Taco/Defibox share tokens × reserves) into each token row; a venue that can't be read hides P/L for tokens history says are pooled, never counts as zero.
- Alcor's on-chain `positions` table is scoped per pool and indexed by owner (index 3); the farm manager's API fallback finds the account's pools from its `swap.alcor:addliquid` history, then sizes each position from the pool's current price.
- Folio gaps trust the deepest provider's get_creator creation transaction; first transfers can lag creation.
- CHEESERam history before live sampling is rebuilt from Hyperion `eosio::rammarket` table deltas (exact Bancor state, EOSDAC nodes) into 12h slots; backfill never alters existing samples, CHEESE fields stay null before CHEESE history, then use that UTC day's close; live samples are never re-priced.
- Crypt writes CRYPT1:/CRYPTKEY1:, reads legacy GPKM1:/GPKMKEY1: and keeps gpk-msg-key files for compatibility.
- CHEESECrypt voice notes are 0x03-headed byte memos assembled by sender+recipient+id across 30-part transactions; play only when complete and digest-verified (batches can partly fail).
- CHEESECrypt names: validated key-file/CP1-note data (newest note wins, never a chat row), apart from per-owner nicknames; WAX accounts stay identities. Friend removal clears contact metadata and blocks rediscovery until re-add, keeping history and groups.
- CHEESECrypt groups are pairwise copies, trusted only fully assembled. CG1 (legacy) members are fixed in-envelope; CG2 invites come from a friend creator (or the creator of a public room you asked, with that listing's key); later copies only grow membership (all existing member keys unchanged); group keys open only that group's notices and invites. Hidden IDs only hide.
- Crypt uses integer fee splits; fanout omits fees explicitly, not by indexes. Confirm payment before local key creation; imports stay free. History uses current rates.
- CHEESECrypt avatars are validated palette-index data in optional key-file fields and separate per-account contact storage; imports rasterize locally, and on-chain key memos stay unchanged to preserve compatibility and avoid executable or remote avatar payloads.
- CHEESECrypt folder pickers start at Desktop but request the vault subfolder; retry permission failures because Chromium protects Desktop-root access. Profile precedes keys; edits refresh only verified matching-key backups (staged writes), else download.
- CHEESECrypt: one vault/device; friends/ loads into all accounts (per-account edits), only explicit saves replace; blocked memos drop undecrypted. Keys match by content; reads merge newest.
- Crypt inbox: bounded discovery; strangers quarantined until accepted.
- Crypt reply views use per-message receipts so jumps preserve skipped replies; scroll only the inner list.
- Crypt About: DappAbout + crypto dialog.
- CHEESECrypt page sections (hero, key setup, sidebar, chat header, composer, message bubble) are presentational components in components/crypt; all state, effects and handlers stay in Messenger so one owner keeps chat state consistent.
- OpenMojiIcon's optional tint paints a glyph as a solid silhouette in a given color; use it when an OpenMoji artwork's own palette is too dark for the always-dark background.
- Both NFT players normalize media via nftMedia (case-insensitive audio/clip/video, reference-only sound/mp3/sfx aliases); version music caches on detection changes to avoid stale classifications.
- CHEESEFolio fiat/BTC/ETH figures are WAX→USD→currency per day (fx-usd-history.json, units per USD); unknown rates stay unknown.
- Folio JSON validates/checksums raw history, merges by sequence and portfolios by ID/newest edit; IndexedDB stores both per account. Views filter the full ledger with per-token disposal P/L, never replay subsets.

- CHEESECrypt public rooms are plaintext CRYPTROOM1: listings on paid eosio.null CHEESE fee legs (newest per creator+room wins, unlist hides); join requests are encrypted CG2 notices, read from strangers only through a separate decode path; member lists never go on-chain.
- CHEESECrypt v2 key files seal the secret with an Anchor signature over a fixed, 2020-expired, never-broadcast zero-CHEESE transfer (own scheme, not WAXCrypt's); sealing signs twice and verifies, locked files never auto-prompt the wallet, and profile edits refresh fields outside the seal so a locked backup is never downgraded. The Anchor plugin is patched to give long-expired requests a 3-minute prompt/link window, since Anchor otherwise cancels them instantly; signed bytes stay unchanged.
- CHEESECrypt contract (contracts/cheesecrypt) mirrors app fees/caps/rooms/moderation/edits; change both plus APP_SYNC.md together so they never drift.
- CHEESECrypt message reports are encrypted CG2 `report` notices (members → owner + admins, admins → owner for ban review), accepted only from the role allowed at send time and matched to rows by pre-edit digest; they notify only and never change moderation state.
