# CHEESEHub roadmap

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
