# CHEESEHub roadmap
- [x] CHEESEFolio: named portfolios with scoped holdings/activity/P&L/CSVs and combined JSON restore; automated creation/save/clear/load/sync/account isolation verified.
- [ ] CHEESEFolio portfolios: verify with real wallet balances/history in the live page — requires a connected WAX wallet; automated flow uses controlled balances and history services.
- [x] CHEESEAir suffix: bounded requests, no dead-host retry waits, complete-only 60s cache and honest partial warnings; 29 regression tests pass, live .cheese returns 8 accounts in 1.48s (partial provider coverage).
- [x] CHEESECrypt: 100 CHEESE paid key creation, free restores, 80/20 platform fees; fee and onboarding regressions pass. Live payment verification awaits a connected WAX wallet and signing approval.
- [x] Uppercase Audio/common sound fields recognized in both NFT players; stale music cache refreshed and raw bafk playback fallback corrected; 17 tests passed. Real-wallet sound playback remains unverified without the user's NFT/account.
- [x] CHEESECrypt: one cheesecrypt folder shared by all accounts on this device; friends loaded from friends/ for every account (nicknames/removals per account); Save to friends refreshes the friend file. 59 tests passed; real OS folder unverified.
- [x] CHEESECrypt: reversible group hiding and collapsible Hidden groups; 28 tests passed, history preserved after new messages/remount, isolated Chrome hide/reload/view/restore verified.
- [x] CHEESECrypt: profile-first key creation, backup then sharing; verified matching-key profile-only backup updates, download fallback, 57 regression tests passed. Isolated Chrome walkthrough verified initial private/public profile files, edit download and persistence; actual OS folder picker and real-wallet publishing remain unverified.
- [x] CHEESECrypt: hover bin removes saved browser contact details and prevents history rediscovery until explicit re-add; 28 regression tests passed and isolated browser removal checked. Downloaded files and chain messages stay unchanged.
- [x] CHEESECrypt: profile names in key files, private friend nicknames, consistent conversation labels; 38 regression tests passed and isolated Chrome profile/nickname saving checked. Real-wallet contact sharing still needs connected wallets.

- [x] CHEESECrypt: one nulled fee per group-message part, recipient payments unchanged; composer/history current-rate totals, guide and 20 passing regression/compatibility tests. Real WAX signing remains gated on connected wallets below.

- [x] CHEESECrypt: matching heading About button, simple guide and clickable accurate cryptography details.

- [x] CHEESECrypt: ad-hoc groups, encrypted recipient copies, automatic discovery, participant display and compatibility tests (29 tests passed).
- [ ] CHEESECrypt: verify group send/reply and recipient read-back on WAX — requires connected wallets and signing approval; local creation/signing gate and encrypted fanout round-trips tested.

- [x] CHEESECrypt: correct Desktop folder-selection guidance and permission-error recovery; actual OS folder picker requires user verification.

- [x] CHEESECrypt: pixel avatar editor, image/NFT import, key-file sharing and conversation thumbnails; paint/upload/save/read-back checked in browser and 16 compatibility tests passed.
- [ ] CHEESECrypt: verify owned-NFT selection and avatar sharing inside a real conversation — requires a connected WAX wallet.

- [x] Token registry: daily chain-verified metadata snapshot, cached app fallback, and simulated Alcor outage/offline tests (1,974 verified tokens).
- [ ] Token registry activation: user must run GitHub Actions → Token Price History once after these changes reach GitHub; connected-wallet UI verification remains pending a wallet session.

- [x] CHEESEFolio: balance column spacing, close Token-to-Balance gap and inset Realised P/L from the right edge.

- [x] CHEESEFolio: restore compact holdings rows while keeping badges, bought/gifted receipts and all numeric columns visible.

- [x] Prevent CHEESEAir context mismatch during preview updates and verify fresh loading and hot refresh.

- [x] CHEESEAir: show current Token A and Token B quantities in a widened LP holder table without changing payouts.

- [x] Update CHEESEAir subheading: "and liquidity providers" → "or liquidity providers"
- [x] CHEESEAir: equal-split and pro-rata distribution modes for NFT drops
- [x] CHEESEAnal: range-aware total USD volume and USD-only pool volume charts
- [x] Adopt WAX Terminal read patterns: hedged chain reads, per-browser benching of unreachable hosts, text/plain (no CORS preflight), bounded concurrency, draw-then-refresh cache for headline numbers

- [x] CHEESESwap: faster route finding (instant Alcor quote, background search, chain tick fallback, early prefetch)
- [x] Banner ads: WaxEDGE placeholder first, legacy yellow banner as second placeholder when two shared slots are open; placeholder must also work on GitHub Pages (bundled asset)
- [x] Banner ads: replace the legacy yellow second placeholder with GPK Collection Manager, linking through the external-site warning

- [x] CHEESESwap: manual spend-only per-pool route sliders with exact 100% allocation
- [x] CHEESESwap: place manual sliders beneath their pool rows with easier dragging and 1% controls
- [x] CHEESESwap: compact manual pool rows and add viewport-safe scrolling for zoomed and small screens
- [x] CHEESESwap: retain the completed Auto quote for comparison while adjusting Manual routes

- [ ] CHEESEFolio at /folio (hidden, no header link while testing): scanner, classifier, average-cost ledger, holdings/activity/P&L UI, daily token price workflow. Open: speed up order-book fill lookups for heavy traders, add tests, browser check with a signed-in wallet.

- [x] CHEESEFolio: scan starts only on button press; probe working history services; parallel fill lookups (heavy account 6+ min → ~14 s)
- [x] CHEESEFolio full history: deepest provider always used, windows backfill, notification-copy de-dupe

- [x] CHEESECrypt at /crypt (hidden, no header/menu link): encrypted CHEESE-memo messenger migrated from gpkonwax/collection-manager.
