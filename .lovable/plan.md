# Switch block explorer links to the Alcor Explorer

Every link that opens waxblock.io will open https://explorer.alcor.exchange/wax instead.

## What I found (about 45 places across 25 files)

- **Transaction links:** CHEESECrypt messages, NFT and tip cards, quote dialog, CHEESEFolio activity and gifts, the Claim All farms dialog, the admin drop purchase log and airdrop results.
- **Account and contract links:** "contract" links at the bottom of the Ram, PowerUp, Air, Locker, Farm, Dao, Drip, Drops, CHEESENull and Banner Ads pages. Also the Create DAO form, the Wojak unbox manager, wallet token rows, farm staker tables, the RAM "unconfirmed" notice and the home page CHEESE stats banner.
- **Asset link:** the NFT links in the farm stakers table.
- **Messages that mention waxblock.io:** several "we could not confirm it, check waxblock.io" warnings. These will now name the Alcor Explorer.
- **Another explorer:** the transaction success window ("View on Explorer") opens wax.bloks.io. I'll switch it to Alcor too, so every explorer link matches.

## Limits of the Alcor Explorer

I checked the Alcor Explorer's own page addresses. It has pages for accounts, transactions, blocks, keys and tokens.
- **No NFT asset page.** NFT links will open the AtomicHub explorer asset page instead. That's the standard page for WAX NFTs.
- **No direct links to contract tables.** The home stats banner links to specific table views, such as the CHEESE supply table, locker rows, nulled balance and keys. These will open the contract's account page instead, where you can click the Tables tab.

## What stays the same

- Developer notes in the contract and automation guides still mention waxblock.io as a place to sign admin actions. Explorer pages that only display information can't sign actions, so I'll leave those notes alone.

## Technical details

- I'll add `src/lib/explorer.ts` with `explorerTx(id)`, `explorerAccount(name)`, `explorerAsset(id)` and an `EXPLORER_NAME` label. Base: `https://explorer.alcor.exchange/wax`. Paths: `/transaction/{id}` and `/account/{name}`. Asset base: `https://wax.atomichub.io/explorer/asset/wax-mainnet/{id}`.
- I'll keep `WAX_EXPLORER` in `waxConfig.ts`, built from the helper so existing imports keep working.
- I'll replace every hardcoded URL with these helpers. Transaction IDs will be URI-encoded everywhere, as Crypt already does.
- I'll update the two test files that check the old addresses (`folioGiftDialog`, `cryptNftTile`). I'll also add a small `explorer.test.ts` that checks the account, transaction and asset addresses.
- At the end I'll search for `waxblock` and `bloks.io`. The only matches left should be the contract and automation guides.
- I'll add an AGENTS.md rule: all explorer links come from the explorer helper and are never hardcoded.
