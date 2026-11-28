# CHEESECrypt synthetic test

Local test runner simulating client message traffic through `crypt.cheese`.
Used to verify contract fee routing, sponsor budget depletion, and node
response times under periodic and burst loads.

## Setup

1. Copy `config.example.json` to `config.json` and fill in accounts and keys
   (git-ignored; keep it private).
2. Run the Tor helper (`public/downloads/cheesecrypt-tor-proxy-v1.6.mjs`).
3. Run:

   ```
   bun install
   bun run run.ts config.json --dry-run   # builds and signs locally, broadcasts nothing
   bun run run.ts config.json
   ```

## Nightcrawler (separate, optional)

Nightcrawler schedules random **synthetic sample messages**, not readable conversations.
It starts independently of the daytime runner: no history monitoring, reactive batches or
background trickle. It is local-only, never hosted, funded or relayed by CHEESEHub.

1. Copy `night-config.example.json` to private `night-config.json`.
2. Configure only accounts you own, with their separate restricted `cheesecrypt` keys
   (never active/owner). Keep night companion accounts out of the daytime config.
   Link each permission **only** to `crypt.cheese::sendfree`, not `sendmsg` or
   `cheeseburger::transfer`. Extra or unverifiable links are refused. Use a fresh
   dedicated key not present on any other permission; do not reuse the browser's
   Instant Messaging key or replace its permission with a different key.
3. Choose the timezone, hours, counts and optional replies, then set `night.enabled: true`.
4. Start the Tor helper and run:

   ```
   bun run night.ts night-config.json --dry-run
   bun run night.ts night-config.json
   ```

The dry run validates permissions, previews a random schedule, and builds/signs a safety
sample locally only when CPU and sponsorship are available; otherwise it reports a skip.
It broadcasts nothing, writes no progress and exits. Disabled means no
connections or sends. Ctrl+C stops the live runner. Run each command in this directory.

Night progress and daily counters use separate `night-config.night.json` and
`night-config.state.json` files. Keep both across restarts. Progress is committed before
broadcast; failed/uncertain sends are never retried, entries over ten minutes late are
dropped, and the process refuses to run when progress is invalid or unwritable. A live
`.night.json.lock` prevents a second copy. After an unclean shutdown, first confirm the
old process is stopped, then remove **only the lock file**, never the progress/counters.
Changing schedule/accounts requires a new `night-config-*.json` filename (also ignored by git); do not start two
configurations for the same accounts/window or deliberately reset their progress.

Existing daytime configs with `night.enabled: false` still work. An enabled legacy
night section now stops `run.ts` with migration instructions instead of silently
running overnight sends. The scripts share signing safeguards, but never share
configuration or progress. Nightcrawler is strictly sponsored `sendfree` only: no token
transfers, paid fallback, balance scans or automatic CPU top-ups. If sponsorship is
unavailable or CPU is low/unknown, that scheduled entry is skipped, not deferred/retried.
Rent CPU or stake WAX manually. `reserve` stays in the JSON for compatibility but is
unused in this mode. A stolen key can still impersonate the sender, consume CPU/NET/RAM
and use sponsor budget; this is reduced authority, not zero security risk.

The daytime runner is unchanged: paid sends cost 0.0101 CHEESE and CPU top-ups remain
0.0100 CHEESE with a six-hour per-target cooldown. Its transfer link cannot restrict
destinations or amounts on-chain: a stolen daytime key can transfer liquid CHEESE.

Signed broadcasts follow the configured helper with no direct fallback. Account,
budget and transaction-preparation reads still use public `chainApi` nodes and reveal
your IP/account names to them; Anchor is not used here. Random timing does not prove
anonymity or human activity. Publicly shared responders can invite abuse/resource drain
and intermediary liability; this runner accepts only the user's own configured accounts.
