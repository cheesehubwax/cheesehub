# Night cover runner (companion to the Tor helper)

A small downloadable program that runs on the user's own computer and, during hours they choose (e.g. while asleep), sends a few random, empty-looking CHEESECrypt messages to their own account through Tor. Goal: hide the daily "silent block" that reveals timezone and sleep schedule. Works with the browser closed, as long as the computer is on.

## How the user sets it up
1. Privacy settings get a new "🌙 Night cover runner" section with a download link and short instructions.
2. User runs `node cheesecrypt-cover-runner-v1.0.mjs --init --account myaccount`. The runner creates its **own** key on that computer and prints the public half. The private key never leaves the machine and never touches the browser.
3. In the same Privacy section the user pastes that public key and approves one Anchor transaction that creates a separate `cheesecover` permission, allowed to call only `crypt.cheese::sendfree` (same lock-down as Instant Messaging). A "Remove runner access" button deletes it.
4. User runs `node cheesecrypt-cover-runner-v1.0.mjs --account myaccount --window 23:00-06:30 --count 2-4` alongside the Tor helper.

## What it sends
- 1 free `sendfree` action per message, sender and only recipient = the user's own account, memo = random bytes in the real CRYPT2 size range.
- The app already ignores copies addressed to oneself, so nothing appears in chats.
- Sends only inside the chosen window, at random times; hard limits: max 5 per day, at least 45 min apart, 0 sends outside the window.
- Broadcasts only through the Tor helper (`http://127.0.0.1:8088`, which already relays signed broadcasts without retrying). If the helper or Tor is down it skips that slot — it never falls back to the open internet.
- Pays its own CPU/NET (no Greymass Fuel, since contacting Fuel would bypass Tor); checks resources first and pauses if low.

## Honest limitations (shown in the UI)
- Self-addressed messages are recognisable on-chain as "to self". A careful observer could filter them out, so this blurs casual timezone guessing but is not strong protection.
- The computer must be on and awake.
- Costs a little CPU each night; no CHEESE is spent.
- Legal/risk note: low, rate-capped, user-owned traffic to self; no third-party spam, no custody, no key export. Flagged as fine.

## Build order
1. Confirm on chain that the contract accepts a `sendfree` whose only copy is to the sender (if not, stop and report).
2. `public/downloads/cheesecrypt-cover-runner-v1.0.mjs`: zero-dependency Node 18+ script (built-in crypto for K1 key gen/signing, fixed `sendfree` serialization, scheduler, caps, Tor-helper-only broadcast, `--init`, `--dry-run`).
3. `src/lib/cryptCoverRunner.ts`: build/remove permission actions for `cheesecover` (mirrors Instant Messaging setup), public key validation, status read.
4. Privacy dialog section: download, paste key, link/unlink, status, limitations text.
5. Tests: runner signing/serialization against a known vector, schedule caps (window only, ≤5/day, ≥45 min gap), refuses non-loopback proxy; app permission actions only link `sendfree`.
6. AGENTS.md rule.
