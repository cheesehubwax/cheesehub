# CHEESECrypt /tip (Option B: transfer + encrypted tip card)

## What the user sees
- Reply to a message, type `/tip 100 cheese great work!` and send.
- One Anchor prompt shows "Transfer 100.0000 CHEESE to <author>" plus the normal chat message — signed together, so either both happen or neither.
- The chat shows a tip card under the reply: "🧀 Tipped 100 CHEESE to @author — great work!" with a link to the transaction.
- The note text stays private (encrypted in the chat message). The transfer itself is public and its on-chain memo is a fixed neutral "CHEESECrypt tip" (no user text).
- `/tip` without a reply, or tipping yourself, shows a clear error. No menu Tip button yet.

## Rules
- Syntax: `/tip <amount> [cheese] [note]`, case-insensitive; amount > 0, max 4 decimals, formatted to 4 places.
- Recipient is always the author of the replied-to message (works in DMs, groups and public rooms; muted/removed users can't tip, same as sending).
- Before signing: confirm dialog with amount and recipient, Terms checkbox required (existing gate), and check sender's liquid CHEESE covers tip + message fee.
- Tip goes wallet-to-wallet via `cheesetoken::transfer` — crypt.cheese never receives or holds it; no platform fee on the tip itself.
- A tip card is shown as "verified" only when the same transaction contains a matching transfer from the sender to the recipient for that amount; otherwise it shows "unverified tip" (prevents faked tip cards).

## Legal / risk notes (flagged)
- Direct, non-custodial transfers: no money transmission by the platform. Tips are final and irreversible; UI wording says so.
- Tips are publicly visible on-chain (sender, recipient, amount). Users should not rely on tips being anonymous.
- No promises of value/returns; "tip" is a gift. Tax treatment is the users' responsibility (add one line to Terms/About).

## Technical details
- New `src/lib/cryptTips.ts`: `parseTipCommand`, wire line `\u0007T1:<recipient>:<amount>:<author>:<time base36>:<note>`, `encodeTip/parseTip`, and `verifyTip(row, txActions)`.
- `CheeseCrypt.tsx` send path: detect `/tip` before normal send; build message actions as today (DM/group/CG2) with the tip line as encrypted text, and prepend one `cheesetoken::transfer` (sender → recipient, fixed memo) in the same transaction.
- Router compatibility: the extra transfer breaks the exact router shape, so tip transactions use the existing direct (non-router) path; APP_SYNC.md notes this. No contract change needed. When messages later become free (contract change), tips remain a separate user-signed transfer — the only remaining popup, by design.
- History: tip rows render as a card in `ChatMessageItem.tsx` (not shown as raw code; excluded from search raw text, counted as a normal message for unread). Verification reads the transaction actions already fetched for router resolution / Hyperion, cached like router lookups.
- Tests `src/test/cryptTips.test.ts`: parsing (amounts, decimals, missing reply, self-tip, note), wire round-trip, verification accepts matching transfer and rejects mismatched amount/recipient/sender.
- AGENTS.md: one rule for tip verification and direct-path routing.
