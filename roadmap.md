# CHEESEHub roadmap

Open tasks only. Completed work lives in git history.

- [ ] CHEESECrypt shared room key: verify owner on/off/re-enable and member message readback on WAX; requires the user's test accounts and wallet signatures.

- [ ] Verify real YouTube title/picture lookups through the user’s Windows v1.8 Tor helper; 48 app/helper tests and browser title/picture readback pass with no direct fallback. Requires the user’s running local Tor connection; playback and Anchor remain separate.

- [ ] Eventhorizon: confirm the original unlocked room after updating; quota-safe device stores, a 256 KiB Respect snapshot cap and non-destructive cache recovery pass unlocked-room tests and actual Chromium quota recovery on desktop/mobile. Original user history/key remains unavailable.

- [ ] Nightcrawler Privacy setup: verify one real Anchor permission creation and folder save on the user's machine; config/ZIP downloads read back in browser with offline keys, permission and overwrite safeguards tested. Requires the user's Anchor signature and local folder permission.

- [ ] Nightcrawler: verify live activation on the user's machine with sendfree-only isolated keys and Tor helper; separation, signing, disk readback and restart safety are tested offline. No real keys or local Tor connection are available here.

- [ ] CHEESECrypt busy-room safety: confirm eventhorizon's original unlocked room; 500-reply/multiple-sender observer stress and unlocked-fixture recovery preserve drafts and receipts, but their original wallet/key and browser error are unavailable here.

- [ ] CHEESEFarm: verify one real capacity-aware stake with the user's Anchor wallet; per-rule warnings, browse-to-detail live checks and 41 capacity/action tests pass, including mixed rates, combined selections and fresh pre-sign checks. Requires the user's wallet signature.

- [ ] CHEESECrypt public-room opening: confirm eventhorizon's original room with their unlocked wallet — cross-chat render recovery, mounted-list reply tracking, safe navigation and storage-failure handling pass 80 targeted tests plus two private/legacy navigation checks; live signed-out page has no runtime errors. Original history/key unavailable here; two existing admission-test failures also reproduce against the unchanged page. Sweep coverage is recorded in `.lovable/reviews/crypt-chat-safety-sweep.md`.

- [ ] CHEESECrypt NFT picker: verify scrolling/loading beyond 100 NFTs with the user's full collection after Anchor unlock; stable single-scroll layout, shared visibility and bounded queue are implemented, but the user's unlocked wallet is unavailable here.

- [ ] CHEESECrypt: confirm restored owned room with the user's original Anchor key/folder; authenticated owner recovery and encrypted per-account backups pass reset/reopen/leave-consent tests, but the user's wallet signature and local folder are unavailable here.

- [ ] CHEESECrypt loading: verify real Anchor-unlocked restart speed through the user's Tor helper; encrypted local restore/new-message/restart readback and 63 security/history tests pass, but the user's wallet and local Tor connection are unavailable here.

- [ ] CHEESECrypt Tor helper: replace v1.1 with v1.2 and confirm one real Anchor-signed CHEESECrypt broadcast through the user's Windows Tor setup; 48 app tests plus 8 helper tests cover transport, exact bytes, no-retry and privacy, but the user's wallet/Tor connection is unavailable here. Fuel and wallet-service traffic remain separate.

- [ ] CHEESEHub node resilience: verify real Anchor unlock/power-up with the user's signatures; health-ordered wallet transport and bounded reads are implemented, outage regression tests pass, and live WAX reads/PowerUp state succeed with eosusa and greymass unavailable. Never auto-rebroadcast payments.

- [ ] CHEESECrypt tips: verify one real public-room tip with Anchor and chat readback — direct tip + paid router delivery and sender/all-recipient encrypted readback/verification pass automated tests; requires the user's wallet signature.

- [ ] CHEESEPower: activate and verify one signed reward claim / CPU stake — runner, tests and setup instructions are ready; requires the user's dedicated compound permission, GitHub secret and enable variable.

- [ ] CHEESEAir: verify one signed airdrop and chain readback — requires the user's Anchor signatures. Phases 1–3 safety/render checks pass, and live 500-row snapshot/edit/selection checks pass without sending funds; remaining audit findings are recorded in `.lovable/cheeseair-audit.md` for later stages.

- [ ] CHEESECrypt: verify routed voice and join/rejoin requests on WAX — requires the user's Anchor signatures; check crypt.cheese payment/sendmsg, 80/20 split and decrypted sender/recipient readback.

- [ ] CHEESECrypt: verify successful public-mirror video streaming; private switching/external links/consent tests pass and browser observed no video-service requests before play or Google requests during the private attempt, but the default mirror returned “No compatible source.” Requires a functioning public proxy; no automatic Google fallback.

- [ ] CHEESECrypt: verify owner-approved readmission on WAX using the user's Anchor wallet; automated request/acceptance/fresh-roster/profile/departure checks pass, but the wallet and private key are unavailable here.

- [ ] CHEESECrypt: verify mandatory creation/legacy locking with the user's Anchor wallet and local folder; automated signing-retry, sealed-backup, restart-unlock and preservation tests cover the client flow.

- [ ] CHEESECrypt: confirm recovery for bum.gpk with its original key in the user's wallet session; automatic bounded member recovery beyond the first page, account-switch readback, failed-read sequencing and Maximum privacy pass 68 targeted tests, but that private key is unavailable here.

- [ ] CHEESECrypt: verify 50-member admissions/delivery and CPU/NET feasibility, room mutes/removals, admins and message collapsing, message edits, owner edit logs, group send/reply, invite groups, public rooms, public inbox, profile notes, replies and Anchor key lock/unlock on WAX — requires connected wallets and signing approval.
- [ ] CHEESECrypt key rotation: verify one real rotation (two Anchor lock signatures, backup save, paid friend notices) and a friend switching keys — needs the user's Anchor wallet. Room owner rekey (swapping a member's pinned key) is a later step; until then rooms keep the old key.
- [ ] CHEESECrypt: verify owned-NFT avatar sharing and the OS folder picker in a real session.
- [ ] CHEESEFolio (/folio, hidden): verify live prices and portfolios with a real connected wallet.
- [ ] CHEESECrypt atomic blind router: deployed on mainnet with user-confirmed message delivery and 80/20 split; still verify underpayment rejection, change/refund/reclaim, rollback and maximum resources with the user's Anchor signatures. Authenticated sender decoding is integrated. `payfee` (key creation/publishing, listings) is written and tested; deployed on mainnet (ABI verified) and `CRYPT_PAYFEE_LIVE` is on; still verify one signed key publish and listing.
- [ ] Token registry activation: run GitHub Actions → Token Price History once after changes reach GitHub.

- [ ] CHEESEFolio tidy: Stages 1-6 done; remaining: live check with a connected wallet (sync, holdings, pool rows, file save/load) — needs the user's wallet sign-in in the preview.

- [ ] ALCORBridge (/bridge, no menu link yet by request): verify one real bridge-in with the user's EVM wallet or exchange withdrawal; page, deposit address, routes and transfers read live here.

- [ ] CHEESEWallet tidy: done (tests, live server order, image fallback, Alcor split, farm cards). Remaining: one signed farm claim/stake and stake/RAM read in a connected wallet — needs the user's Anchor sign-in.
