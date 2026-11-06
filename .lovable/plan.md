# Sponsored (free) CHEESECrypt text messages — 500 CHEESE/day budget

## Goal
Users send text/NFT/link/control messages with **no token transfer** in their transaction. `crypt.cheese` pays the same per-part fee from its own pre-funded balance, still split 80% to `eosio.null` (nulled) and 20% to `xcheeseliqst`. The contract never receives or holds user funds for these messages. Voice notes, key creation, room listings and tips stay user-paid as today.

## What changes for users
- Sending a normal message = one action only (`crypt.cheese::sendmsg`). No CHEESE leaves their wallet.
- This makes Anchor whitelisting / a messaging-only session key safe later (separate follow-up; Anchor's auto-sign behaviour still to be confirmed by testing).
- When the day's 500 CHEESE budget is used up, the app shows "Free messaging budget reached for today" and offers to send as a normal paid message (current flow) so chat never stops.
- Recipients no longer receive 0.0001 CHEESE dust per message.

## Important consequence (must be accepted)
**How messages are delivered today:** each message is a tiny 0.0001 CHEESE payment to the recipient, and the scrambled (encrypted) message text is written in that payment's note. The recipient's app finds their messages by looking through the CHEESE payments their account received.

**What changes:** with no more tiny payments, there is no payment note to carry the text. Instead, the scrambled text is written directly into the "send message" instruction the sender signs with `crypt.cheese`. The blockchain still tags the recipient's account on that instruction (`require_recipient`), so it shows up in their account history just like a payment would.

**What the app must do:** look in two places when loading a chat — the old payment notes (all existing messages) and the new message instructions (all new free messages) — then merge them into one conversation in time order.

**Effect on you:** nothing is lost. Old messages stay exactly where they are and still open. Privacy is the same, because the text is equally scrambled in both places; only who can read it (sender and recipient) can unscramble it.

## Contract changes (`contracts/cheesecrypt/`)
1. New separate table `budget` (singleton): `daily_limit` (default 500.0000 CHEESE), `day_start` (UTC seconds), `spent_today`, `sponsor_enabled` (default false). Kept separate from `config` so the existing config layout never changes (avoids the cheesepowerz-style row-format problem).
2. New owner action `setbudget(daily_limit, sponsor_enabled)` — `crypt.cheese@active` only.
3. New action `sendfree(sender, parts, copies)`:
   - `require_auth(sender)`, not paused, same shape/recipient/memo checks as `sendmsg`.
   - Anti-spam: per-sender cooldown table (`lastsend`, sender pays own RAM row? No — contract pays; tiny row, bounded) with minimum gap (config value, default 2 s) and per-sender daily part cap (default 500 parts).
   - Rolls the 24h window, checks `spent_today + fee <= daily_limit`, else fails with a clear "budget reached" error.
   - Calls existing `pay_platform` (80/20) from contract balance; `require_recipient` once per distinct recipient; no token sent to recipients.
4. `sendmsg` (paid path) unchanged so voice notes and fallback keep working.
5. Native tests in `tests/router_rules_test.cpp` for window rollover, budget ceiling, cooldown and integer 80/20 split.
6. `APP_SYNC.md` + `README.md`: new actions, tables, budget rules, Windows CMD Docker build + deploy + `setbudget` steps (literal, step-by-step).

## App changes
- `cheeseCrypt.ts` send path: if sponsorship live (read `budget` table, switch on) and message is text/NFT/control → build single `sendfree` action; otherwise current paid path. Voice always paid.
- History readers: add Hyperion query for `crypt.cheese::sendfree` actions where the account is sender or notified recipient; decrypt `copies[].memo` exactly like transfer memos; attribute only to the authorising `sender`. Merge/dedupe with existing transfer history; router IndexedDB cache reused.
- Composer: small "Free message" indicator; budget-reached fallback prompt.
- Admin monitor: crypt.cheese card shows today's budget used / limit, contract CHEESE balance, low-balance warning (< 2 days of budget).
- About/Guide text updated; Crypt fee memory updated.
- Tests: send-path selection, history decode of sponsored actions, budget-reached fallback.

## Flags (legal / risk)
- Non-custodial: you fund your own account, users never send it funds — low money-transmission risk.
- Sponsoring free messages means you pay for third-party content distribution; content is encrypted and you cannot moderate it on-chain. Keep Terms wording that users are responsible for content.
- Treasury drain is capped at 500 CHEESE/day worst case; spam across many accounts can exhaust the daily budget early (denial of free service, not loss beyond the cap).
- CPU/NET is still paid by the sender's own account.

## Rollout
1. Build & deploy contract (Docker CMD steps). 2. Fund `crypt.cheese` with CHEESE. 3. Run `setbudget 500.0000 CHEESE, true`. 4. App detects switch and starts using free sends; can be turned off instantly with `setbudget ..., false`.
