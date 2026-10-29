# CHEESEHub roadmap

Open tasks only. Completed work lives in git history.

- [ ] CHEESECrypt: add direct Rejoin from former members' chats and public listings; verify retained-key eligibility, moderation and normal fees.

- [ ] CHEESECrypt: verify mandatory creation/legacy locking with the user's Anchor wallet and local folder; automated signing-retry, sealed-backup, restart-unlock and preservation tests cover the client flow.

- [ ] CHEESECrypt: confirm recovery for bum.gpk with its original key in the user's wallet session; automated recovery/reload/account-switch/tab tests pass, but that private key is unavailable here.

- [ ] CHEESECrypt: verify 50-member admissions/delivery and CPU/NET feasibility, room mutes/removals, admins and message collapsing, message edits, owner edit logs, group send/reply, invite groups, public rooms, public inbox, profile notes, replies and Anchor key lock/unlock on WAX — requires connected wallets and signing approval.
- [ ] CHEESECrypt: verify owned-NFT avatar sharing and the OS folder picker in a real session.
- [ ] CHEESEFolio (/folio, hidden): verify live prices and portfolios with a real connected wallet.
- [ ] CHEESECrypt atomic blind router (zero custody, transient pending payments): owner deploys to a fresh testnet account; verify chain auth/fees/change/refund/rollback/resources, then add authenticated original-sender trace decoding before app integration — waits on deployment. Multi-action voice fee continuation remains unsupported; voice, key publishing and public listings stay direct.
- [ ] Token registry activation: run GitHub Actions → Token Price History once after changes reach GitHub.
