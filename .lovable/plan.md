# Fix: Daily powerup ran twice and hours late

## What happened today

The workflow has two cron ticks: `00:17 UTC` (primary) and `02:17 UTC` (backup). GitHub's scheduler delayed both. They eventually ran near `05:00 UTC`, and **both performed the full payout** — so every staker got CHEESE twice.

The idempotency guard in `scripts/daily-powerup/run.ts` is supposed to make the second tick a no-op. It failed for two reasons:

1. **Hyperion lag.** The guard queries Hyperion (`get_recent_inbound_transfers`) to count transfers since `00:00 UTC`. Per project memory, Hyperion can lag up to 60 minutes. When the second delayed tick ran shortly after the first, Hyperion still reported zero transfers from the signer → guard passed → second payout fired.
2. **Threshold too forgiving.** The guard only short-circuits at `>= 10 distinct memo accounts`. It was designed to let a backup tick "top up" a partial-failure day. In practice, with Hyperion lag, it cannot distinguish "today already ran" from "today's run is still indexing", so the safer thing is a hard `already ran → exit`.

## Goal (per your spec)

- Auto-powerup runs **once per UTC day**.
- Lands **as close to 00:17 UTC as possible**.
- If GitHub delays the scheduler, still runs **once, late**, rather than skipping.
- Never pays twice, even if Hyperion is stale or two ticks fire near-simultaneously.

## Plan

### 1. Replace the Hyperion-based guard with a GitHub-Actions run-history guard

In `scripts/daily-powerup/run.ts`, when running inside GitHub Actions (`GITHUB_ACTIONS=true`), query the GitHub REST API for prior runs of this same workflow today:

```
GET /repos/{owner}/{repo}/actions/workflows/daily-powerup.yml/runs
    ?status=success&created=>=YYYY-MM-DDT00:00:00Z
```

If any prior run today exists with `conclusion === "success"` **and** a `run_id` different from the current `GITHUB_RUN_ID`, log `already ran today` and exit 0.

Why this is bulletproof:
- The signal is owned by GitHub itself, not by an indexer with lag.
- It updates the instant a run finishes, so a tick that starts even one second after another tick succeeded sees the prior success immediately.
- It is independent of on-chain state, so a partial Hyperion outage cannot defeat it.

Keep the existing `FORCE=1` bypass for manual re-runs. Keep the Hyperion check as a **secondary** guard (defense-in-depth) but lower its threshold from `>= 10` to `>= 1` distinct signer→cheesepowerz memo today — so any visible prior payout, however small, also short-circuits. The watchdog still alerts on full-miss days.

The workflow needs to expose a token to the script. Add to `daily-powerup.yml`:

```yaml
permissions:
  actions: read
  contents: read
```

and `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` in the run step's `env`. No new repo secret required — `GITHUB_TOKEN` is auto-provisioned per run.

### 2. Replace the 02:17 backup tick with a tight cluster of retries near 00:17

In `.github/workflows/daily-powerup.yml`, change the schedule from:

```yaml
- cron: "17 0 * * *"
- cron: "17 2 * * *"
```

to a short ladder of attempts, each guarded by step 1's run-history check so only the first to succeed actually pays:

```yaml
- cron: "17 0 * * *"   # primary
- cron: "32 0 * * *"   # retry +15m
- cron: "47 0 * * *"   # retry +30m
- cron: "17 1 * * *"   # retry +1h
- cron: "17 2 * * *"   # retry +2h
- cron: "17 4 * * *"   # last-chance for badly delayed scheduler days
```

Effect: on a normal day, the 00:17 tick succeeds and every later tick exits immediately via the run-history guard. On a delayed day, the earliest tick that GitHub actually dispatches wins — usually within minutes of 00:17, worst case within hours, and still exactly once.

Keep `concurrency: { group: daily-powerup, cancel-in-progress: false }` so two ticks can never overlap mid-payout.

### 3. Keep the watchdog as-is

`daily-powerup-watchdog.yml` at `03:30 UTC` already alerts on full-miss days. The new last-chance tick at `04:17 UTC` runs *after* the watchdog, so on heavily-delayed days you still get an alert and the system still recovers later that day.

## Files touched

- `.github/workflows/daily-powerup.yml` — new cron ladder, drop 02:17 backup line, add `permissions:` block, pass `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_RUN_ID` to the run step.
- `scripts/daily-powerup/run.ts` — add `alreadyRanViaActionsHistory()` pre-flight; lower Hyperion threshold from 10 to 1; keep `FORCE=1` bypass; both checks must pass before paying.

No changes to `watchdog.ts`, `waxRpc.ts` helpers, `filterStakers.ts`, `waxSign.ts`, or the contract.

## Out of scope

- No change to payout amounts, eligibility, batching, or signer setup.
- No new repo secrets or variables.
- No on-chain contract changes.

## Risk and verification

- **Worst case if guard breaks**: same as today — possible double-pay. Mitigated by *two* independent guards (Actions history + Hyperion ≥1 memo), where one is lag-free.
- **Verification after merge**:
  1. Wait for tomorrow's 00:17 tick → confirm Actions tab shows one `success` run and the later 00:32 / 00:47 / 01:17 / 02:17 / 04:17 ticks each log `already ran today; exiting 0` and finish in seconds.
  2. Spot-check on-chain: exactly one CHEESE transfer per eligible staker from `power.chz` → `cheesepowerz` with their account as memo, dated today.
  3. Manually trigger `workflow_dispatch` with `force=1` → confirm it bypasses both guards and runs as before.
