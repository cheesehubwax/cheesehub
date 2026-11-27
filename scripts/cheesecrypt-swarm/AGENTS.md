# Swarm runner rules

- Keep the runner isolated (own package and lockfile, not wired into the frontend or CI) so unattended signing never runs unless the user starts it by hand.
- Amounts, timing, shapes and permission checks live in pure tested `policy.ts`; use integer CHEESE units because float amounts would misprice sends.
- The send shape must stay exactly the app's: lone `sendfree` when the live budget covers it, else payment then one-part `sendmsg` (so bots never split from free users by action shape) and decoy memos must match real padded memo length so they stay indistinguishable by size.
- Never retry an ambiguous broadcast, and refuse keys that are on owner/active, because extra authority exceeds what an unattended script should hold.
- Bots must never trigger bursts for each other, and nothing here may be hosted, relayed or auto-funded by CHEESEHub (custody and intermediary liability).
- Auto-powerup is a 0.0100 CHEESE transfer to cheesepowerz (memo = target) planned in pure `planPowerup`: unknown CPU never buys, one per target per 6h recorded before broadcast, stuck bots are paid for by the best-CPU bot, because repeat or blind buys would waste CHEESE.
