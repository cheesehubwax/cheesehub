# CHEESECrypt: Move to Another Device by QR Code

Move your locked key, friends, nicknames and room memberships from one device (e.g. PC) to another (e.g. phone) by pointing the phone camera at the screen. No server, no upload, no files to copy.

## What the user sees

**On the old device** (CHEESECrypt menu → "Move to another device"):
1. Warning: "Anyone who films this screen and sees the code could copy your friends list. Your key stays locked to your Anchor wallet."
2. A moving QR code (cycles through a few frames if the data is large) and a one-time code shown in large text, e.g. `K7QM-4XRA-92TF`.
3. Closes automatically after 5 minutes or when you press Done. A new code is made each time.

**On the new device** (sign-in screen and menu → "Receive from another device"):
1. Camera opens; progress bar fills as frames are read ("3 of 5").
2. Type the one-time code.
3. Preview: "Account dr.cheese · 24 friends · 6 nicknames · 3 rooms". Choose **Import**.
4. Connect Anchor and approve the usual free unlock — the key cannot be used without the wallet.
5. If the new device already has CHEESECrypt data for that account, items are merged (newest wins), never wiped.

If the camera isn't available, a "paste text instead" option accepts the same data.

## Safety rules

- Only the Anchor-locked key is ever transferred, never a plain key. Wrong account in Anchor = refused.
- One-time code is 12 random characters (about 60 bits), not a 6-digit PIN: 6 digits could be guessed in seconds from a photo of the QR. Slow key-stretching is added on top.
- Data is encrypted and tamper-checked; any altered frame fails the whole import.
- Instant Messaging keys and sponsor/admin settings are never transferred (Instant Messaging is re-enabled on the new device with one approval).
- Nothing leaves the two screens: no network request is made during transfer.

## Legal / liability note

Fully local and non-custodial, so CHEESEHub hosts and relays nothing — the lowest-risk option. Remaining risk is user-side (someone filming the screen); the warning above and the separate code cover that. No other grey areas identified.

## Technical details

- New `src/lib/cryptDeviceTransfer.ts` (pure, tested):
  - Bundle v1 `{ v, account, lockedKey, contacts, contactAvatars, nicknames, removedContacts, roomRequests, blocklist, createdAt }`, built from existing loaders in `cheeseCrypt.ts` and related modules; refuses to build if the key isn't a `LockedKeyFile`.
  - Deflate (CompressionStream) → AES-256-GCM with key from PBKDF2-SHA256 (600k iterations) over the code + random salt; account name bound as associated data.
  - Framing `CXFER1:<id>:<n>/<total>:<base64url>` sized ~800 chars per frame; reassembly by id, duplicate/out-of-order tolerant.
  - Import validates every field, merges via existing save functions (newest wins, removed/blocked lists respected, scoped room keys never become contacts).
- `src/components/crypt/DeviceTransferSendDialog.tsx` — uses existing `qrcode.react`, frames cycle ~4/s, 5-minute expiry, clears from memory on close.
- `src/components/crypt/DeviceTransferReceiveDialog.tsx` — camera scanning via native BarcodeDetector where available, otherwise a pinned small scanner library (`jsqr`, iOS Safari lacks BarcodeDetector); paste fallback.
- Wire entry points in `CheeseCrypt.tsx` (menu + signed-out/no-key screen); presentational only, Messenger keeps state.
- Update `CryptAbout.tsx` (how to move devices) and `src/components/crypt/AGENTS.md` rule.
- No contract change, no fee, nothing on chain; `APP_SYNC.md` untouched.
- Tests: round trip, wrong code, tampered frame, missing frame, wrong account, plain key refused, merge keeps newer entries and respects removals/blocks.
- Verify in browser: send dialog renders and cycles; receive via paste path imports into a second browser profile.
