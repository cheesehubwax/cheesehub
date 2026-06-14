# Daily Powerup — Reliable Scheduling

## Problem

The workflow is scheduled at `0 0 * * *` (00:00 UTC). GitHub Actions scheduled jobs at the top of an hour — especially 00:00 UTC — are routinely delayed or silently skipped when the shared scheduler is under load. There is currently:

- only one cron tick per day,
- no idempotency guard,
- no alert when a day is missed.

So one bad tick = a whole skipped day, with no signal.

## Plan

### 1. Move the cron off the top of the hour and add a backup tick

Update `.github/workflows/daily-powerup.yml`:

```yaml
on:
  schedule:
    # Primary: 00:17 UTC (off the top of the hour to dodge scheduler congestion)
    - cron: "17 0 * * *"
    # Backup: 02:17 UTC, in case the primary tick is dropped
    - cron: "17 2 * * *"
  workflow_dispatch:
    ...
```

The existing `concurrency: { group: daily-powerup, cancel-in-progress: false }` already prevents the two ticks from running on top of each other if the primary is just late.

### 2. Idempotency guard so the backup tick is a true no-op when the primary already ran

Add a short pre-flight in `scripts/daily-powerup/run.ts` (before the staketable scan):

- Query `cheesepowerz` recent transfers (via Hyperion / waxRpc with existing fallback) for inbound `cheesecheese` CHEESE transfers from `SIGNER` in the last ~20 hours.
- If the count is already >= a threshold matching a successful prior run today (e.g. > 10 distinct memo accounts since 00:00 UTC), log `already ran today, exiting 0` and return.
- This means: primary on time -> backup is a clean no-op; primary missed -> backup actually does the work.

Bypass the guard when `workflow_dispatch` is used with a new input `force: "1"` so manual re-runs still work.

### 3. Miss alert

Add a separate tiny workflow `.github/workflows/daily-powerup-watchdog.yml` running at e.g. `30 3 * * *`:

- Calls the same `cheesepowerz` transfer-history check.
- If zero inbound transfers from `SIGNER` since 00:00 UTC, exits non-zero so the run shows up as failed in the Actions tab (which sends the standard GitHub failure email to repo admins).
- Optional: post to a webhook if `DAILY_POWERUP_ALERT_WEBHOOK` secret is set.

### 4. Keep-alive against the 60-day inactivity auto-disable

Already mitigated by the watchdog above (any successful or failing run resets the inactivity timer). Nothing else needed.

## Out of scope

- No changes to staker eligibility, batching, RPC redundancy, transfer amount, or signer setup.
- No changes to the 3-pass staketable scan added previously.
- No persistence layer; the idempotency check reads on-chain history only.

## Technical notes

- New env var consumed by `run.ts`: `FORCE` (`"1"` to bypass the idempotency guard from `workflow_dispatch`).
- New workflow input: `force` (string, default `""`), wired to `FORCE`.
- The transfer-history lookup reuses the existing Hyperion-first fallback in `scripts/daily-powerup/waxRpc.ts`; a small helper `getRecentInboundTransfers(account, fromIso, tokenContract, tokenSymbol)` will be added there.
- Threshold for "already ran" should be conservative (>= 10 distinct memo accounts) so a partial-failure day still allows the backup tick to top up the rest — combined with the existing per-account memo, a top-up will not double-pay any account because every transfer is keyed by memo and the contract's powerup logic is per-account-per-day on `cheesepowerz`.
