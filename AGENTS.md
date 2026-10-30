# Agent rules

- CHEESECrypt private invites retain their original wire cap; public admissions use bounded complete multipart bootstraps for newcomers and owner-authenticated roster-digest predecessor deltas for existing members in one atomic transaction, preserving pairwise keys and first-public protection.

- Crypt moderation: authenticated encrypted CG2 controls, owner-appointed admins for mute/collapse, chain-ordered authority, immutable first-public roster. Retain controls per account; re-derive before edits/unread/rendering. Bans omit future copies, never revoke keys. Mute intervals permanently hide their traffic/quotes. Collapse marks pre-edit digests, never deletes chain copies. Client validation continues after blind-router deployment to avoid explicit role/roster disclosure.

- CHEESECrypt edits resolve authenticated followups against an unambiguous content-and-transaction digest within the same sender/conversation; preserve original row identity/time and apply only complete in-window replacements. Voice edits use a flagged extra target part; owner logs derive from decrypted history only for currently public owned rooms, never central storage.

- Crypt orb: source-controlled public image for external hosting; preview uses its asset pointer since GitHub Pages cannot serve Lovable-relative paths.

- App/recorder token snapshots share a versioned schema/URL; chain-verify precisions, cache no prices, keep unavailable prices unknown to prevent fabricated valuations.
- CHEESEAir keeps context identity in Vite hot data (shared provider/card state).
- CHEESEAir LP token columns aggregate current underlying quantities in normalized pair order, separate from USD payout weights so presentation never changes distribution.
- CHEESEAir suffix unions use timestamp cursors, bounded reads and complete-only cache; stalled providers flag partial results because indexes differ and skip stops at 10,000 rows.
- CHEESEFolio re-derives raw IndexedDB history per account; live balances are truth. Shared prices poll foreground-only/refetch on focus; metadata/placeholders never get live timestamps.
- Folio acquisitions use cumulative trade/free receipts, separate from holdings; never alter basis or infer sources after disposals.
- Folio sync requires reading the deepest provider to the end; big pages sequential, small pages windowed, concurrency capped to avoid Hyperion drops.
- Folio deduplicates global sequences and identical inline transfer creator copies to prevent receiver-notification double counting.
- Folio order-book fills: one large-limit Alcor per-account deal request (skip paging is gappy); only leftovers use Hyperion, routed by provider history start, avoiding slow per-transaction-only lookups.
- CHEESEFolio holdings roll live pool positions (Alcor positions read per pool scope on chain, Taco/Defibox share tokens × reserves) into each token row; a venue that can't be read hides P/L for tokens history says are pooled, never counts as zero.
- Alcor's on-chain `positions` table is scoped per pool and indexed by owner (index 3); the farm manager's API fallback finds the account's pools from its `swap.alcor:addliquid` history, then sizes each position from the pool's current price.
- Folio gaps trust the deepest provider's get_creator creation transaction; first transfers can lag creation.
- CHEESERam history before live sampling is rebuilt from Hyperion `eosio::rammarket` table deltas (exact Bancor state, EOSDAC nodes) into 12h slots; backfill never alters existing samples, CHEESE fields stay null before CHEESE history, then use that UTC day's close; live samples are never re-priced.
- Crypt writes CRYPT1:/CRYPTKEY1:, reads legacy GPKM1:/GPKMKEY1: and keeps gpk-msg-key files for compatibility.
- CHEESECrypt voice notes are 0x03-headed byte memos assembled by sender+recipient+id across 30-part transactions; play only when complete and digest-verified (batches can partly fail).
- Crypt names: validated key-file/CP1 notes (newest wins), then owner admission directories and members' key-authenticated self room syncs (display-only), apart from nicknames; listing `u` is display-only, never authority. WAX accounts stay identities. Friend removal clears metadata/rediscovery until re-add, keeping history/groups. Inbox: bounded discovery; strangers held until accepted.
- Crypt groups use pairwise copies. CG1 rosters are fixed; CG2 invites require a friend creator or requested listing key. Retain member keys; scoped keys never become contacts. After leave, owner readmission with a fresh bootstrap and CG2 readmit must authorize joined notices; stale keys cannot self-rejoin. Preserve bans/mutes and founder protection. Hidden IDs only hide.
- Crypt: shared per-part voice/join fees, no owner surcharge; voice pays per batch. Integer splits; paid creation, free imports; history uses current rates.
- Crypt avatars: validated palette-index key-file/contact data, locally rasterized imports; key memos unchanged. No executable/remote payloads.
- Crypt folder pickers: a picked vault/key/friends folder is reused as-is, else cheesecrypt is created inside; stale remembered handles are forgotten. Profile precedes keys; edits refresh only verified matching-key backups, else download.
- CHEESECrypt: one vault/device; friends/ loads into all accounts (per-account edits), only explicit saves replace; blocked memos drop undecrypted. Keys match by content; reads merge newest.
- Crypt reply views use per-message receipts (jumps keep skipped replies), inner-list scroll only. About: DappAbout + crypto dialog.
- Crypt sections are presentational; Messenger owns state. Recovery needs authenticated DM/join evidence; tab sync preserves consent/scoped keys. Join alerts share account/room/requester/time identities; only confirmed handling clears matching toast, counts and chat controls, retaining others.
- OpenMojiIcon tint paints a solid silhouette for palettes too dark against dark backgrounds.
- Both NFT players normalize media via nftMedia (case-insensitive audio/clip/video, reference-only sound/mp3/sfx aliases); version music caches on detection changes to avoid stale classifications.
- CHEESEFolio fiat/BTC/ETH figures are WAX→USD→currency per day (fx-usd-history.json, units per USD); unknown rates stay unknown.
- Folio JSON validates/checksums raw history, merges by sequence and portfolios by ID/newest edit; IndexedDB stores both per account. Views filter the full ledger with per-token disposal P/L, never replay subsets.

- CHEESECrypt public rooms are plaintext CRYPTROOM1: listings on paid eosio.null CHEESE fee legs (newest per creator+room wins, unlist hides); join requests are CG2 notices carrying the requester key after the ciphertext (no publishing; that key opens only joins) via a separate decode path; member lists never go on-chain.
- Crypt seals v2 files with two verified Anchor signatures over a fixed expired zero-CHEESE transfer; signed bytes stay unchanged. Session-only secrets and verified seal/open gates prevent plain-key access/storage; paid signing retries preserve the pending key. Backups/profile writes stay sealed; stored envelopes never prove unlocking. Anchor's long-expired prompt/link window is patched without changing signed bytes.
- CHEESECrypt contract is a blind atomic fee router, zero custody: config plus a transient pending table only, no stored balances; payment and sendmsg share one transaction, change refunded inline, reclaim covers orphans. Keep rules synced with APP_SYNC.md; room authority, moderation and edits stay authenticated client policy. Router history must bind sendmsg senders to inline transfers by action ancestry before integration; direct publishing/listings/voice remain until verified.
- Crypt reports: CG2 `report` notices (members→owner+admins, admins→owner), checked against send-time role, matched by pre-edit digest; notify only.
- Crypt YouTube: curated HTTPS proxies, manual private cycling, no preloads, per-play Google consent; load events never prove playback. Mirror links suppress referrers only. Expansion promotes a persistent native dialog to the top layer; never relocate its iframe, which restarts playback.
