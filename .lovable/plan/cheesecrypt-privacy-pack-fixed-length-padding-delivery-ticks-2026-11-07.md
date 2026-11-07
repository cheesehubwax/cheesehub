# CHEESECrypt privacy pack: Fixed-Length Padding, Delivery Ticks, Safety Numbers

All three are app-only changes. **No smart contract update is needed** (the router is blind to memo contents and charges per part, not per byte). Fees do not change.

## 1. Fixed-length padding (hides message length)

What users see: nothing changes. What the chain sees: every encrypted part is the same size, so a "ok" looks identical to a full-length message.

- New messages pad each part's plaintext up to the full single-part capacity before encrypting, and the receiver strips it after decrypting.
- Padded messages use a new marker `CRYPT2:` (instead of `CRYPT1:`). This avoids guessing: old `CRYPT1:` messages are read exactly as today, so all history stays readable.
- Padding scheme: one `0x80` byte then zeros (standard ISO/IEC 7816-4), applied to the raw bytes, so it works for text, multi-part messages, replies, reactions, edits, NFT shares, group/room controls and voice note parts alike.
- Multi-part: every part, including the last short one, is padded, so the part count is the only length signal left (unavoidable without extra paid parts).
- Anything that compares or fingerprints content (edit targets, reply quotes, report digests, search) works on the unpadded plaintext, so edits/reports of new messages keep matching.

Rollout caveat: a browser tab still running the old app version cannot read `CRYPT2:` messages until it refreshes. Since the app is a single website, this resolves itself on reload; I'll show "Refresh to read this message" instead of a blank for any unreadable `CRYPT2:` memo.

## 2. Delivery ticks

- After sending, your message shows **one tick** ("Sent — in a block") as soon as the transaction ID is confirmed.
- It changes to **two ticks** ("Permanent") once that block is irreversible on WAX (typically a few minutes).
- Shown only on your own messages; hover/tap explains the meaning. Messages loaded from history that are already old show two ticks immediately.
- Checks are light: one shared poll of the chain's latest irreversible block every ~15s while any of your messages is still pending, stopping when none are.

## 3. Safety numbers

- New "Verify" option in the chat header for direct chats (and on each room member).
- Shows a 60-digit safety number (12 groups of 5) plus a QR code, computed from both accounts' CHEESECrypt public keys and account names. Both people see the same number.
- Instructions: compare in person or over a call; if they match, nobody has swapped keys.
- You can mark a contact "Verified" (stored only in your browser and in your friends backup). If that contact's key later changes, the badge drops and a warning appears in the chat.
- Nothing is sent on chain; no fee.

## Also updated

- About section: short entries on padding, ticks and safety numbers.
- Agent rules and APP_SYNC notes recording "padding/ticks/safety numbers: client-only, no contract change".

## Technical details

- `src/lib/cheeseCrypt.ts`: add `MSG_PREFIX_V2 = 'CRYPT2:'`; `msgPrefixOf` accepts it; `encryptBytesMemo` pads to `MAX_PLAINTEXT_BYTES - 1` content + marker and writes V2; `decryptMemoBytes` strips padding only for V2 and rejects malformed padding (returns null). Recompute `MAX_PLAINTEXT_BYTES` so a V2 padded memo still fits the 256-byte memo limit (capacity drops by 1 byte for the pad marker); `PART_BODY_BYTES` follows. Router/sponsor shape check (line ~364) already uses `msgPrefixOf`, so V2 memos stay eligible for free `sendfree`.
- Audit every `encryptMemo`/`encryptBytesMemo` caller (voice, groups, invites, rooms, moderation, edits, reactions, tips, inbox) to confirm none hard-codes `CRYPT1:` or memo length; key-file prefixes (`CRYPTKEY1:`) and plaintext room listings are untouched.
- New `src/lib/cryptDelivery.ts` + hook: tracks `{txId, blockNum}` per sent message, polls `get_info.last_irreversible_block_num` through the existing endpoint resolver.
- New `src/lib/cryptSafety.ts`: SHA-512 iterated fingerprint (Signal-style) over sorted `(account, publicKey)` pairs, rendered as 60 digits; QR via existing or lightweight QR library; verified map keyed by account + key.
- New `SafetyNumberDialog.tsx`; tick indicator inside `ChatMessageItem.tsx`; Verify entry in `CryptChatHeader.tsx`.
- Tests: padding round-trip for 1-byte, max-size and multi-part messages; every V2 memo has identical length; legacy `CRYPT1:` still decrypts; malformed padding rejected; V2 memos still convert to `sendfree`; safety number identical from both sides and changes when a key changes; tick turns permanent only when irreversible block ≥ tx block.

## Risks / notes

- No legal grey area: padding and safety numbers are standard privacy practice (Signal, WhatsApp). Sender authentication on chain is unchanged, so CHEESECrypt is not a mixer.
- Padding hides length within a part, not timing, sender, recipients or part count — those stay public on chain.
