# CHEESECrypt Encrypted Voice Notes (up to 10 seconds, on chain)

## What users get
- A "🎙️ Voice" button beside Attach NFT, in direct chats and groups.
- Press to record (up to 10 s, with a countdown ring). Stop, listen back, then Send or Discard.
- Before signing, the sender sees the duration, the number of parts and transactions, and the total CHEESE cost.
- The recording is encrypted in your browser before it goes on chain, in exactly the same way as text messages. Only the people in the chat can play it.
- The receiver sees a play bubble with the duration. If any parts have not arrived yet, it shows "Voice note loading (x/y parts)". If parts are missing, it shows "Voice note incomplete" and does not try to play the broken audio.
- Recordings are never uploaded anywhere. The audio exists only as encrypted memos on WAX.

## Size and sending
- Recording format: Opus mono at the lowest speech bitrate the browser accepts (about 6–8 kbps). 10 s comes to roughly 8–10 KB.
- Each memo carries about 135 bytes of audio, so a 10 s note is roughly 60–75 parts.
- Parts are sent in batches of up to 30 per transaction, so about 2–3 transactions per note (5 at most). Each transaction is a separate wallet signature, and they are signed one after another.
- If a later transaction fails or is cancelled, the parts already sent stay on chain. The sender sees "Voice note partly sent". The receiver sees it as incomplete, and it is never played.

## Cost (message rate, as agreed)
- Each part costs 0.0010 CHEESE to each recipient plus 0.0100 CHEESE nulled. Groups use the existing group rule: one nulled fee per part plus 0.0010 per recipient.
- Example: a 10 s DM with about 70 parts costs about 0.77 CHEESE.
- The Terms checkbox is required. The fees count toward the `crypt` row in Null by Contract automatically, because they use the same fee memo.

## Limitations to show in the About guide
- Safari and iPhone record in a different audio format. Recording there may be disabled or produce larger files. Playback of Opus/WebM on Safari will be checked, with a clear "not supported in this browser" note as the fallback.
- A voice note uses many transactions, so the sender needs enough CPU/NET.
- As with all messages, the accounts involved and the time are public on WAX. The audio itself is not.

## Technical details
- New `src/lib/cryptVoice.ts`:
  - Recording uses `MediaRecorder` with `audio/webm;codecs=opus`, `audioBitsPerSecond` 6000, a hard stop at 10 s and an 12 KB byte cap.
  - New byte-level encryption helpers (`encryptBytesMemo` / `decryptBytesMemo`) share the `GPKM1:` memo prefix, so the memo format and Null tracking stay unchanged. The plaintext is raw bytes, not base64 text, which keeps the parts dense.
  - Each part starts with a header: marker byte `0x02` + 6-char voice id + 2-byte part index + 2-byte total + 1-byte MIME code. The first part also carries the duration and a SHA-256 of the full audio.
  - Reassembly groups parts by sender + recipient + voice id across transactions (not by txId). The note plays only when every part is present and the hash matches.
  - The audio type is checked by its magic bytes (WebM/Ogg) before a blob URL is made.
- Existing text decoding: plaintext that starts with `0x02` is routed to the voice assembler, so old clients' message formats are not affected. Older clients will show it as unreadable, which is acceptable.
- Sending reuses `buildSendMessageActions` per batch for DMs and the `cryptGroups` per-recipient fanout for groups. Cost is shown through `messageCost` / `groupMessageCost`.
- History fetch: a single 500-row page may cut a note in half. `fetchMessages` will page further (cursor by time) until the current window's voice notes are complete or a set cap is reached. Live polling also keeps notes that are still incomplete waiting for their remaining parts.
- UI: a recorder component in `src/components/crypt/VoiceRecorder.tsx`, and a playback bubble in `VoiceNoteBubble.tsx` (play/pause, duration, progress), wired into `CheeseCrypt.tsx`. Unread badges count a voice note once.
- Tests (`src/test/cryptVoice.test.ts`):
  - split→encrypt→decrypt→assemble round trip
  - parts arriving out of order and across transactions
  - a missing part or a wrong hash is rejected
  - a 10 s / 12 KB cap is enforced
  - batches never exceed 30 parts
  - DM and 3-person group cost equals the per-part message rate × parts
- AGENTS.md rule: voice notes are byte-encrypted `GPKM1:` multipart memos assembled by voice id across transactions, played only when complete and hash-verified.
