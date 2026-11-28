# Shared-key public rooms via eosio.null (stealth format)

## Correction first
Our messages today use the `CRYPT1:` prefix, not `CRYPT2:` (earlier wording was wrong). Room messages will use the same `CRYPT1:<nonce>:<box>` shape and size padding as ordinary messages, so on explorers they look like any other CHEESECrypt copy.

## What changes for users
- Public room owners get a "Shared room key" switch in room settings (off by default).
- When on, each message is sent once to `eosio.null` instead of one copy per member. On-chain, group size and member accounts are no longer visible from each send.
- Existing rooms can switch on: the owner sends the key to current members privately; old messages still read normally.
- When someone is banned or leaves, the owner's client offers a one-click "Rekey room" (paid like a normal group notice); removed members cannot read anything after that point.

## Confirmed constraints (checked in the contract)
- `crypt.cheese` accepts `eosio.null` as a copy recipient (it exists and is neither sender nor contract); memos stay 1–256 bytes; up to 35 parts.
- The contract simply notifies the recipient; nothing is stored for `eosio.null`.

## Honest privacy limits
- The sender's account and send time stay public.
- Anyone who scans all `crypt.cheese` sends to `eosio.null` can count room traffic in total, but not which room or who reads it.
- Members must download every eosio.null copy and try their room keys, which is more reading than today.
- Old members who left keep the old key and can read messages from before the rekey.
- Legal note: no account you own relays traffic; you stay the publisher of open-source software, not an operator.

## Build order
1. Room key format + symmetric encryption (fresh 32-byte key, XSalsa20-Poly1305 via TweetNaCl), author signature inside the ciphertext so a member cannot pose as another member.
2. Key delivery: new CG2 `room-key` control (owner → each member, pairwise), with epoch number; readmission and new joins receive the current key.
3. Reading: one shared, bounded scan of `crypt.cheese` sends to `eosio.null`, trial-decrypt with every held room key, then feed results into the existing moderation, edit, mute/ban and unread pipelines unchanged.
4. Sending: room messages build one copy to `eosio.null`; uniform router shape kept so fees, free sends, jitter and voice batching still work.
5. Owner switch, rekey prompt, About/privacy copy update.
6. Tests: wrong-key rejection, forged author rejection, rekey cut-off, banned-member exclusion, mixing with legacy pairwise history, 500-message stress read.

## Technical details
- New `src/lib/cryptRoomKey.ts` (key gen, seal/open, signature over roomId+epoch+body; roomId lives only inside the ciphertext).
- Key stored with existing scoped room keys in the vault (sealed, never plaintext at rest).
- `cryptInviteGroups.ts`: CG2 `room-key` action, owner-only, chain-ordered, verified like other controls.
- Stream reader uses resolveEndpoints() ordering and Tor helper routing; results cached per account in IndexedDB.
- Fees: one shared per-part fee (80/20 split) per send instead of per-member; confirm pricing with you before building.
- AGENTS.md rule added for the eosio.null room stream.
