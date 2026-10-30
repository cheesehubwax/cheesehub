# CHEESEHub roadmap

Open tasks only. Completed work lives in git history.

- [ ] CHEESEAir: verify one signed airdrop and chain readback — requires the user's Anchor signatures. Phases 1–3 safety/render checks pass, and live 500-row snapshot/edit/selection checks pass without sending funds; remaining audit findings are recorded in `.lovable/cheeseair-audit.md` for later stages.

- [ ] Verify flattened voice and join/rejoin fees on WAX — requires the user's Anchor signatures; automated fee/delivery checks cover the changed paths.

- [ ] CHEESECrypt: verify successful public-mirror video streaming; private switching/external links/consent tests pass and browser observed no video-service requests before play or Google requests during the private attempt, but the default mirror returned “No compatible source.” Requires a functioning public proxy; no automatic Google fallback.

- [ ] CHEESECrypt: verify owner-approved readmission on WAX using the user's Anchor wallet; automated request/acceptance/fresh-roster/profile/departure checks pass, but the wallet and private key are unavailable here.

- [ ] CHEESECrypt: verify mandatory creation/legacy locking with the user's Anchor wallet and local folder; automated signing-retry, sealed-backup, restart-unlock and preservation tests cover the client flow.

- [ ] CHEESECrypt: confirm recovery for bum.gpk with its original key in the user's wallet session; automated recovery/reload/account-switch/tab tests pass, but that private key is unavailable here.

- [ ] CHEESECrypt: verify 50-member admissions/delivery and CPU/NET feasibility, room mutes/removals, admins and message collapsing, message edits, owner edit logs, group send/reply, invite groups, public rooms, public inbox, profile notes, replies and Anchor key lock/unlock on WAX — requires connected wallets and signing approval.
- [ ] CHEESECrypt: verify owned-NFT avatar sharing and the OS folder picker in a real session.
- [ ] CHEESEFolio (/folio, hidden): verify live prices and portfolios with a real connected wallet.
- [ ] CHEESECrypt atomic blind router (zero custody, transient pending payments): owner deploys to a fresh testnet account; verify chain auth/fees/change/refund/rollback/resources, then add authenticated original-sender trace decoding before app integration — waits on deployment. Voice now charges per part in each batch; voice, key publishing and public listings stay direct pending integration gates.
- [ ] Token registry activation: run GitHub Actions → Token Price History once after changes reach GitHub.

- [ ] CHEESEFolio tidy: Stages 1-3 done (golden ledger, sync engine, valuation safety); Stages 4-6 (UI split, render perf, cleanup) pending approval one at a time
