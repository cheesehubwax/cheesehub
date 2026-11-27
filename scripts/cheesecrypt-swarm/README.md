# CHEESECrypt cover-traffic swarm

A local script you run yourself. It uses a few of **your own** bot accounts to send ordinary-looking
CHEESECrypt messages to each other, so your real messages sit inside more background activity.
Nothing is hosted or relayed by CHEESEHub, and no one but you holds the keys.

## What it does
- **Trickle:** each bot sends at random (Poisson) intervals, around the clock, so there is no quiet night gap.
- **Bursts:** when someone who is not one of your bots sends through `crypt.cheese`, 1–3 random bots send after
  staggered delays (default 45s–15min). Limited to a set number of bursts per hour.
- Each send matches what the app signs: a lone free `crypt.cheese::sendfree` (like Instant Messaging users) while the
  live sponsor budget covers it, otherwise a paid `sendmsg` (0.0101 CHEESE: 0.0100 fee + 0.0001 copy). It stays inside
  your swarm. Decoy memos are random bytes with the exact length of a real padded `CRYPT2:` message.
- Bots never message themselves (the contract rejects it) and never trigger bursts for each other.

## Setup
1. Create bot accounts one at a time over days or weeks, with varied names.
2. Fund each from an unlinked source, with CHEESE for fees plus enough staked CPU/NET (or a PowerUp) for resources.
3. On each bot add a dedicated permission (for example `cheesecrypt`) with a **new key that is not on owner or active**,
   and linkauth it to `cheeseburger::transfer`, `crypt.cheese::sendmsg` and `crypt.cheese::sendfree` only.
4. `cp swarm-config.example.json swarm-config.json` and fill in accounts and keys (the file is git-ignored; keep it private).
5. Run the Tor helper (`public/downloads/cheesecrypt-tor-proxy-v1.5.mjs`), then:
   ```
   bun install
   bun run run.ts swarm-config.json --dry-run   # builds and signs locally, broadcasts nothing
   bun run run.ts swarm-config.json
   ```
   The computer must be on; the screen may be off.

## Built-in safety
- Refuses to start if the key is also on `owner`/`active`, the permission is missing, or its links exceed the two above.
- Never sends if it would drop a bot below `reserve`, or past `maxSendsPerBotPerDay` (UTC day, kept across restarts).
- One send at a time; every broadcast is a single attempt and is never retried (an uncertain result is counted as used).
- Loopback-only helper addresses; with `broadcast` set to the helper, signed transactions go only through it.

## Honest limits
- **Chain analysis still sees the bots.** Anyone can group accounts that only talk to each other; the cover works best
  when bots look like ordinary community accounts and traffic is not perfectly regular. It is not a guarantee of anonymity.
- Do not fund bots from your main wallet, or reuse your main key's patterns, or message your real contacts from a bot.
- `broadcast: "direct"` shows your IP to the node. Chain reads (balances, ABIs) are public metadata and go direct;
  only history reads and broadcasts use the Tor helper.
- Free sends draw on the same daily sponsor budget real users share; keep rates low so bots never use it up.
- Bots pay their own CPU/NET; app sends may be covered by Greymass Fuel, which adds a visible extra action.
- You pay all fees and resources. The permission link cannot limit amounts on-chain; the limits above are script-only.
- Do not run bots to flood the network. Keep rates low; the defaults cost roughly pennies per day.
