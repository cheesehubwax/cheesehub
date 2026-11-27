# Synthetic test runner rules

- Keep the runner isolated (own package and lockfile, not wired into the frontend or CI) so unattended signing never runs unless the user starts it by hand.
- Use neutral naming (workers, batches, sample messages) in code and logs, but keep docs truthful about what it does; config keys (`bots`, `burst*`) stay unchanged for compatibility with existing local configs.
- Amounts, timing, shapes and permission checks live in pure tested `policy.ts`; use integer CHEESE units because float amounts would misprice sends.
- The send shape must stay exactly the app's: lone `sendfree` when the live budget covers it, else payment then one-part `sendmsg`, and sample memos must match real padded memo length so they stay indistinguishable by size.
- Never retry an ambiguous broadcast, and refuse keys that are on owner/active, because extra authority exceeds what an unattended script should hold.
- Workers must never trigger batches for each other, and nothing here may be hosted, relayed or auto-funded by CHEESEHub (custody and intermediary liability).
- Auto-powerup is a 0.0100 CHEESE transfer to cheesepowerz (memo = target) planned in pure `planPowerup`: unknown CPU never buys, one per target per 6h recorded before broadcast, stuck workers are paid for by the best-CPU worker, because repeat or blind buys would waste CHEESE.
- Nightcrawler starts only through standalone `night.ts` with its own account configuration/state; `run.ts` rejects enabled legacy night settings, because night accounts must never enter daytime batches. Shared `runtime.ts` owns signing/resources without starting timers.
- The night schedule is planned per local window in pure `planNight`; `nightState.ts` locks each live configuration and atomically persists sent/dropped IDs before serialized sends, failing closed on corrupt/unwritable progress so restarts never repeat sends.
- Signed writes run outside read fallback loops and require an executed receipt with the matching transaction ID; ambiguous outcomes stop rather than rebroadcast.
