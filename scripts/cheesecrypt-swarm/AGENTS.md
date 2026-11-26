# Swarm runner rules

- Keep the runner isolated (own package and lockfile, not wired into the frontend or CI) so unattended signing never runs unless the user starts it by hand.
- Amounts, timing, shapes and permission checks live in pure tested `policy.ts`; use integer CHEESE units because float amounts would misprice sends.
- The send shape must stay exactly the app's router shape (payment then one-part `sendmsg`, 80/20 fee paid by the contract) and decoy memos must match real padded memo length so they stay indistinguishable by size.
- Never retry an ambiguous broadcast, and refuse keys that are on owner/active, because extra authority exceeds what an unattended script should hold.
- Bots must never trigger bursts for each other, and nothing here may be hosted, relayed or auto-funded by CHEESEHub (custody and intermediary liability).
