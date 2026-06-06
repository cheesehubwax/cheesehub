### Goal
Raise the daily powerup eligibility threshold from 1000 CHEESE staked to 5000 CHEESE staked.

### Changes
1. `scripts/daily-powerup/run.ts` — change `const MIN_STAKED = 1000` to `5000`.
2. `scripts/daily-powerup/README.md` — update all references from `1000` to `5000`.

### Outcome
The cron will only power up accounts with `>= 5000 CHEESE` staked, reducing the daily CHEESE spend and recipient count.