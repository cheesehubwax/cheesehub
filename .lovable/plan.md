# Bring WAXCrypt upgrades into CHEESECrypt, step by step

## Ground rules (every step)
- Fees stay CHEESE: 100 CHEESE key creation; every platform fee splits **80% to eosio.null / 20% to xcheeseliqst** (this is what the code already does; the earlier note saying "cheesedao / hole.cheese" was wrong). The 0.0010 CHEESE per part sent to each recipient is unchanged. Fees are counted in whole units only.
- Reading old messages stays the same: CRYPT1:/CRYPTKEY1: plus the older GPKM1:/GPKMKEY1:, existing key files, friends folder and groups.
- CHEESE look: yellow accents, emoji headings, the Terms checkbox before anything paid.
- Each step ships on its own with tests, and the existing 90 messenger tests keep passing. A step only counts as done once it has been checked.

## Steps (in order, one per request)

1. **Local block list.** You can block an account on this device only. Blocked senders are skipped before their messages are decrypted, which hides their DMs, group messages and invites. There's a Blocked list with Unblock, and Block on a friend's chat. Nothing changes on-chain.
2. **Profile editing and profile updates.** The pencil (already there) gets a matching dialog. Name and avatar changes go out to friends and group members as an encrypted profile note, and the newest note wins. Each part costs the normal CHEESE text fee.
3. **NFT presentation.** Sound-effect NFTs show as borderless tiles: click to play, autoplay when sent, no metadata caption. Other NFTs show as tiles that open a bigger view with picture, name, collection, asset ID and transaction link. Messages with NFTs keep the same encrypted bytes.
4. **Read state and finding your key file.** Unread markers merge between the browser and the vault folder (newest wins). The private key file is found by its contents, so file names, BOM/UTF-16 and hidden .txt files all work.
5. **Encrypted group invites and in-group friend requests.** Groups grow to up to 8 members. The creator sends invites inside encrypted messages, and you choose Join or Decline (with Decline and block). Join, leave and group name/picture updates also travel in encrypted messages. Keys a group introduces only work inside that group. Group members can send friend requests (Accept/Decline). Groups you already have keep working.
6. **Opt-in public inbox.** Off by default. When on, people you haven't added can reach you in "Message requests" (Accept / Decline / Block), text and NFTs only. Their keys are looked up within set limits.
7. **Public rooms.** A creator can list a room on-chain (CRYPTROOM1: memo, 80/20 CHEESE fee). Anyone can search rooms and send an encrypted join request, and the creator accepts using the normal invite. The member list never goes on-chain.
8. **Locking your key to your wallet (last, highest risk).** A sealed v2 private key file can only be opened with a signature from the owner's Anchor wallet over a fixed, already-expired transaction that is never broadcast. Creation signs twice and refuses to lock unless both signatures match. Old unlocked files still load and get an Upgrade button. CHEESECrypt uses its own lock scheme, never WAXCrypt's.

## How each step is built
- Copy the matching pure module from WAXCrypt (blocklist, profile, nft-messages, read-state, groups, rooms, keylock) into `src/lib/crypt*`. Swap WAX amounts and the eosio.null-only fees for CHEESE amounts via the existing `cheeseCrypt.ts` fee helpers, and keep the CHEESE memo prefixes.
- Add the matching UI piece to `src/components/crypt/`, wired into `src/pages/CheeseCrypt.tsx`. If that page gets too big, split it into smaller pieces when a step needs it.
- Every step comes with unit tests that check exact fee amounts (80/20 split, per-recipient carriers) and that old files still read.
- `AGENTS.md` and the CHEESECrypt memory files get updated as each rule lands.

## Not included
- WAXCrypt's planned relay smart contract and its "free key creation" switch. CHEESECrypt keeps the paid 100 CHEESE key creation.
- Changes to the WAX-only wording. All text stays CHEESECrypt.

I'll start with step 1 once you approve.
