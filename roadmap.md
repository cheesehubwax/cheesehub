# CHEESEHub roadmap

Open tasks only. Completed work lives in git history.

- [ ] CHEESECrypt loading: verify real Anchor-unlocked restart speed through the user's Tor helper; encrypted local restore/new-message/restart readback and 63 security/history tests pass, but the user's wallet and local Tor connection are unavailable here.

- [ ] CHEESECrypt Tor helper: confirm v1.1 replacement and browser local-network permission on the user's Windows PC; Tor-only HTTPS/certificate/timeouts tests and the real Tor-backed Privacy dialog save pass here, and Windows replacement commands are in the plan.

- [ ] CHEESEHub node resilience: verify real Anchor unlock/power-up with the user's signatures; health-ordered wallet transport and bounded reads are implemented, outage regression tests pass, and live WAX reads/PowerUp state succeed with eosusa and greymass unavailable. Never auto-rebroadcast payments.

- [ ] CHEESECrypt tips: verify one real public-room tip with Anchor and chat readback — direct tip + paid router delivery and sender/all-recipient encrypted readback/verification pass automated tests; requires the user's wallet signature.

- [ ] CHEESEPower: activate and verify one signed reward claim / CPU stake — runner, tests and setup instructions are ready; requires the user's dedicated compound permission, GitHub secret and enable variable.

- [ ] CHEESEAir: verify one signed airdrop and chain readback — requires the user's Anchor signatures. Phases 1–3 safety/render checks pass, and live 500-row snapshot/edit/selection checks pass without sending funds; remaining audit findings are recorded in `.lovable/cheeseair-audit.md` for later stages.

- [ ] CHEESECrypt: verify routed voice and join/rejoin requests on WAX — requires the user's Anchor signatures; check crypt.cheese payment/sendmsg, 80/20 split and decrypted sender/recipient readback.

- [ ] CHEESECrypt: verify successful public-mirror video streaming; private switching/external links/consent tests pass and browser observed no video-service requests before play or Google requests during the private attempt, but the default mirror returned “No compatible source.” Requires a functioning public proxy; no automatic Google fallback.

- [ ] CHEESECrypt: verify owner-approved readmission on WAX using the user's Anchor wallet; automated request/acceptance/fresh-roster/profile/departure checks pass, but the wallet and private key are unavailable here.

- [ ] CHEESECrypt: verify mandatory creation/legacy locking with the user's Anchor wallet and local folder; automated signing-retry, sealed-backup, restart-unlock and preservation tests cover the client flow.

- [ ] CHEESECrypt: confirm recovery for bum.gpk with its original key in the user's wallet session; automated recovery/reload/account-switch/tab tests pass, but that private key is unavailable here.

- [ ] CHEESECrypt: verify 50-member admissions/delivery and CPU/NET feasibility, room mutes/removals, admins and message collapsing, message edits, owner edit logs, group send/reply, invite groups, public rooms, public inbox, profile notes, replies and Anchor key lock/unlock on WAX — requires connected wallets and signing approval.
- [ ] CHEESECrypt key rotation: verify one real rotation (two Anchor lock signatures, backup save, paid friend notices) and a friend switching keys — needs the user's Anchor wallet. Room owner rekey (swapping a member's pinned key) is a later step; until then rooms keep the old key.
- [ ] CHEESECrypt: verify owned-NFT avatar sharing and the OS folder picker in a real session.
- [ ] CHEESEFolio (/folio, hidden): verify live prices and portfolios with a real connected wallet.
- [ ] CHEESECrypt atomic blind router: deployed on mainnet with user-confirmed message delivery and 80/20 split; still verify underpayment rejection, change/refund/reclaim, rollback and maximum resources with the user's Anchor signatures. Authenticated sender decoding is integrated. `payfee` (key creation/publishing, listings) is written and tested; deployed on mainnet (ABI verified) and `CRYPT_PAYFEE_LIVE` is on; still verify one signed key publish and listing.
- [ ] Token registry activation: run GitHub Actions → Token Price History once after changes reach GitHub.

- [ ] CHEESEFolio tidy: Stages 1-6 done; remaining: live check with a connected wallet (sync, holdings, pool rows, file save/load) — needs the user's wallet sign-in in the preview.
