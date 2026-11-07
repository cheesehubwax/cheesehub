# CHEESECrypt Phase 1 — Secret Chat release gates

## Current implementation

An isolated, non-live prototype uses pinned `@kinsh/vodozemac-wasm@0.4.2` Olm (Double Ratchet), not Megolm or custom cryptography. Ordinary chats, friends, rooms, key files, and the contract are unchanged. `SECRET_CHAT_LIVE` is false; there is no real Secret Chat send button yet.

The prototype generates independent random identity/prekeys, checks the expected sender identity on initial decryption, clones session snapshots before advancing, and frees WASM objects. Serialization is secret material and stays in test/session memory: there is deliberately no persistence or export yet.

Opaque `CRYPTS1:` framing fragments one complete ratchet ciphertext, not separately static-encrypted plaintext chunks. Each fragment is 256 ASCII bytes, with a random 128-bit message identifier, index/count and a whole-envelope SHA-512-derived 256-bit corruption checksum. All fragments must share one transaction and authenticated account pair; missing, mixed and conflicting fragments fail closed. The checksum is NOT sender authentication; only successful ratchet decryption plus authenticated WAX attribution can establish that.

## Required before real sending

1. Review the binding and its Rust dependencies. The vodozemac core audit does not audit this wrapper or CHEESECrypt. Confirm compatibility/vector tests and bounded skipped-key behaviour.
2. Add explicit request/accept handshake in ordinary authenticated encrypted controls, binding chain ID, both accounts, independent Secret Chat identities, conversation/device identifiers and protocol version. No sensitive secret-chat text travels in ordinary static encryption. No silent downgrade. Define simultaneous requests, replay and identity replacement.
3. Implement a new encrypted IndexedDB store. Use an independently random root key, wallet-wrapped with a separate domain; do not derive deleted ratchet keys from the ordinary identity or Anchor signature. Enforce verified unlock at the storage/service boundary. Harden full resolved wallet signing request verification.
4. Serialize across tabs. Atomic encrypted commits cover next ratchet state, exact outbox ciphertext, stable message ID, replay receipts, consumed prekeys and optional local transcript. Commit before broadcast; retry exact ciphertext after ambiguous failure. Never resume rolled-back session exports.
5. Keep a separately encrypted own-message transcript rather than a static-key self-copy. Explain that retained history can be exposed by device/archive compromise even though consumed protocol keys are gone. Identity backups do not restore Secret Chats. Losing browser data ends sessions; a new device must establish fresh sessions. Decide a clear retention policy before UI release.
6. Add independent selection, request/accept/end/delete controls, safety-number checks bound to Secret identities, delivery state and unread handling. Never leak Secret traffic into ordinary chat recovery/search/edits/groups. Preserve account-switch and block-before-decryption gates.
7. Explicitly add the new transport to router/sponsor/history adapters only after checks pass. Verify deployed byte/part limits, same-transaction original sender attribution, paid/sponsored delivery and CPU/NET costs. Extra headers can increase part count, fees or sponsor consumption.
8. Exercise two independent browsers with real test accounts: handshake, message/readback, reload, out-of-order, multi-tab, storage failure, ambiguous broadcast, identity change, logout, deletion and no downgrade. A real wallet end-to-end test cannot be replaced by a signed-out screenshot.

## Claims and legal caveats

Forward secrecy applies to deleted message keys, not plaintext retained by either participant, old live-session backups, active device compromise or quantum resistance. Account names, recipients, timings and part counts remain public. Key erasure in browser/WASM memory is best-effort, not a forensic guarantee.

Client-side encryption is not inherently unlawful, but legality varies by jurisdiction; no universal legal assurance is appropriate. Sponsor-funded immutable encrypted publishing retains content/liability considerations. This phase adds no relay, file hosting, custody, or anonymized funds transfer.

## Sources

- https://github.com/matrix-org/vodozemac
- https://matrix.org/blog/2022/05/16/independent-public-audit-of-vodozemac-a-native-rust-reference-implementation-of-matrix-end-to-end-encryption/
- https://github.com/Meneleus/vodozemac-bindings
- https://github.com/matrix-org/matrix-sdk-crypto-wasm