# CHEESECrypt: new CRYPT memo prefixes + encrypted 10-second voice notes

Both changes ship together, so voice notes go out with the new prefix from the start.

## Part 1 — Rebrand the on-chain memos

What users get
- New messages are sent with `CRYPT1:` (it was `GPKM1:`). New key broadcasts are sent with `CRYPTKEY1:` (it was `GPKMKEY1:`).
- Old chats, old published keys and old Null-by-Contract totals keep working. The app still reads both the old and new prefixes.
- Message length stays the same: up to 146 bytes per part. The prefix is one byte longer, but the encrypted text still fits in the same 256-byte memo.
- The fee memo `CHEESECrypt messaging fee` stays the same.
- Key and backup files stay the same (`gpk-msg-key` / `gpk-msg-pubkey`), so existing backups and friends' files still load. Only memos change.

Rules
- Sending: always uses `CRYPT1:` / `CRYPTKEY1:`.
- Reading messages: accepts `CRYPT1:` and `GPKM1:`.
- Key lookup: accepts `CRYPTKEY1:` and `GPKMKEY1:`, and uses the newest one either way.
- Null by Contract `crypt` row: counts the fee memo, `CRYPTKEY1:` and `GPKMKEY1:`.

## Part 2 — Encrypted voice notes (up to 10 s)

What users get
- A "🎙️ Voice" button beside Attach NFT, in direct chats and groups.
- Record for up to 10 s with a countdown. Stop, listen back, then Send or Discard.
- Before signing, the sender sees the duration, the number of parts and transactions, and the total CHEESE cost. The Terms checkbox is required.
- The audio is encrypted in the browser the same way as text messages. It is never uploaded anywhere: it exists only as encrypted `CRYPT1:` memos on WAX.
- The receiver sees a play bubble with the duration. While parts are still arriving it shows "Voice note loading (x/y parts)". If parts are missing it shows "Voice note incomplete", and the broken audio is never played.

Size and sending
- Opus mono at about 6 kbps. 10 s comes to roughly 8–10 KB, with a hard cap of 12 KB.
- About 135 bytes of audio fit in each memo, so a note is roughly 60–90 parts.
- Up to 30 parts go in each transaction, so a note takes 2–3 transactions (5 at most). Each one is a separate wallet signature, signed one after another.
- If a later transaction fails or is cancelled, the parts already sent stay on chain. The sender sees "Voice note partly sent", and the receiver sees the note as incomplete.

Cost (same as messages)
- Direct chat: 0.0110 CHEESE per part (0.0010 to the recipient + 0.0100 nulled). A note of about 70 parts costs about 0.77 CHEESE.
- Groups: one 0.0100 nulled fee per part plus 0.0010 per recipient (the existing group rule).
- The fees count in the `crypt` Null by Contract row automatically.

Limitations to add to the About guide
- Safari and iPhone may not record in this format. There the Voice button is disabled with a "not supported in this browser" note. Playback is checked the same way.
- A note uses several transactions, so the sender needs enough CPU/NET.
- As with all messages, the accounts involved and the time are public. The audio is not.

## Technical details

- `src/lib/cheeseCrypt.ts`:
  - Add `MSG_PREFIX = 'CRYPT1:'`, `KEY_PREFIX = 'CRYPTKEY1:'`, plus `LEGACY_MSG_PREFIX` and `LEGACY_KEY_PREFIX`.
  - Add a `msgPrefixOf(memo)` helper used by `decryptMemo`, `fetchMessages` and `lookupPublishedKey`.
  - `MAX_PLAINTEXT_BYTES` is recomputed and asserted to stay 146.
  - Add `encryptBytesMemo` / `decryptBytesMemo` for raw byte payloads with the same box construction.
- `src/lib/cheeseNullBreakdown.ts`: the matcher accepts both key prefixes.
- New `src/lib/cryptVoice.ts`:
  - Recording: `MediaRecorder` with `audio/webm;codecs=opus` and `audioBitsPerSecond` 6000. It stops at 10 s and at 12 KB.
  - Part header: `0x02` marker + 6-char id + 2-byte index + 2-byte total + 1-byte MIME code. Part 0 also carries the duration and a SHA-256 of the whole audio.
  - Reassembly groups parts by sender + recipient + voice id across transactions. A note plays only when it is complete, the hash matches and the magic bytes are valid WebM/Ogg. A blob URL is made only after that and revoked on unmount.
  - Batching: at most 30 parts per transaction. Sending uses `buildSendMessageActions` for DMs and the `cryptGroups` fanout for groups.
- Decoding: byte plaintext that starts with `0x02` goes to the voice assembler, and text and multipart text are unchanged. Unread badges count each voice note once.
- History: `fetchMessages` pages further back by timestamp (up to a fixed cap) when the newest window contains incomplete voice notes. Live polling keeps incomplete notes pending.
- UI: `src/components/crypt/VoiceRecorder.tsx` and `VoiceNoteBubble.tsx`, wired into `CheeseCrypt.tsx`. The About guide gets the limitations above.
- Tests:
  - New messages and keys use `CRYPT1:` / `CRYPTKEY1:`.
  - Legacy `GPKM1:` messages and `GPKMKEY1:` keys still decrypt and resolve.
  - The 146-byte limit is unchanged.
  - The Null row counts both key prefixes.
  - Voice: round trip; parts out of order and across transactions; a missing part or bad hash is rejected; the 10 s / 12 KB caps; at most 30 parts per transaction; DM and 3-person group cost equals the per-part rate × parts.
- AGENTS.md: replace the "original wire formats" rule. New rule: memos send `CRYPT1:`/`CRYPTKEY1:` and still read the legacy GPKM prefixes, and key-file types are unchanged. Add a voice-note rule: byte-encrypted multipart memos assembled by voice id across transactions, played only when complete and hash-verified.
