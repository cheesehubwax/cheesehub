# CHEESECrypt synthetic test

A local script you run yourself. It uses a few of **your own** worker accounts to send ordinary CHEESECrypt
sample messages to each other, generating steady background traffic through `crypt.cheese`.
Nothing is hosted or relayed by CHEESEHub, and no one but you holds the keys.

## What it does
- **Steady sends:** each worker sends at random (Poisson) intervals, around the clock.
- **Reactive batches:** when an account that is not one of your workers sends through `crypt.cheese`, 0–N random
  workers send after staggered delays. Limited to a set number of batches per hour.
- Each send matches what the app signs: a lone free `crypt.cheese::sendfree` while the live sponsor budget covers it,
  otherwise a paid `sendmsg` (0.0101 CHEESE: 0.0100 fee + 0.0001 copy). Sample memos are random bytes with the exact
  length of a real padded `CRYPT2:` message.
- Workers never message themselves (the contract rejects it) and never trigger batches for each other.

## Setup
1. On each worker account add a dedicated permission (for example `cheesecrypt`) with a **new key that is not on owner
   or active**, linked to `cheeseburger::transfer`, `crypt.cheese::sendmsg` and `crypt.cheese::sendfree` only.
2. Copy `config.example.json` to `config.json` and fill in accounts and keys (git-ignored; keep it private).
   The `bots`/`burst*` config keys keep their names so existing configs keep working; an older `swarm-config.json`
   is still picked up when no `config.json` exists.
3. Run the Tor helper (`public/downloads/cheesecrypt-tor-proxy-v1.5.mjs`), then:
   ```
   bun install
   bun run run.ts config.json --dry-run   # builds and signs locally, broadcasts nothing
   bun run run.ts config.json
   ```

## Auto-powerup (backup for staked CPU)
- Before each send the runner reads every worker's available CPU. Below 2,000 µs a worker sends **0.0100 CHEESE** to
  `cheesepowerz` (CHEESEUp) with its own name as the memo. Below 500 µs the worker with the most CPU pays instead.
- At most one powerup per worker every 6 hours (kept across restarts); unknown CPU never buys; the reserve still applies.

## Built-in safety
- Refuses to start if the key is also on `owner`/`active`, the permission is missing, or its links exceed the three above.
- Never sends below `reserve`, or past `maxSendsPerBotPerDay` (UTC day, kept across restarts).
- One send at a time; every broadcast is a single attempt and is never retried.
- Loopback-only helper addresses; with `broadcast` set to the helper, signed transactions go only through it.

## Limits
- Chain analysis can still group accounts that only talk to each other.
- Free sends draw on the same daily sponsor budget real users share; keep rates low.
- You pay all fees and resources. The permission link cannot limit amounts on-chain; the limits above are script-only.
