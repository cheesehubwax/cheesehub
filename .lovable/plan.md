# Add a daily vote-reward claim for `cheesepowerz` to the powerup script

Yes, this is possible, and it fits the existing job cleanly. The claim runs as a second, independent phase after the powerup transfers, and skips itself when the 24h cooldown has not elapsed — exactly the behaviour you described.

## What is true on-chain right now (checked)

- `cheesepowerz` does vote: `eosio::voters` shows `proxy: bigmikeproxy`, `staked` ~62,332 WAX, and a non-zero `unpaid_voteshare`, so it accrues GBM voter rewards.
- Its `last_claim_time` is `2026-08-21T15:20:11` UTC, i.e. it was claimed manually today. The next eligible claim is ~24h after whatever the latest claim time is.
- `cheesepowerz` has only `owner` and `active` permissions, both holding the same key. There is **no** permission the daily script can currently sign with.
- The script signs as `power.chz@dailypower`, and per the README that permission is linked only to `cheeseburger::transfer`. So today it cannot claim for `cheesepowerz`.

That last point is the one blocker, and it is a wallet setup step, not code.

## One-time setup you do (before the code matters)

`eosio::claimgbmvote(owner)` requires the authority of `owner`, so `cheesepowerz` itself must authorise the claim. Two options:

- **Option A (recommended) — reuse the existing script key.** On `cheesepowerz`, add a new permission `claimvote`, parent `active`, whose key is the **public** key of the `WAX_DAILYPOWER_KEY` already in GitHub secrets. Then link it to only that one action:
  ```
  cleos set action permission cheesepowerz eosio claimgbmvote claimvote
  ```
  Nothing new goes into GitHub. The one key can now do two things and nothing else: send CHEESE from `power.chz`, and claim vote rewards for `cheesepowerz`.
- **Option B — separate key.** Fresh keypair for `cheesepowerz@claimvote`, linked the same way, added as a second GitHub secret. More isolation, one more secret to manage.

Either way the key can never move WAX, unstake, or change votes, because `linkauth` restricts it to `claimgbmvote`.

## How the claim phase behaves

Order per run: powerup transfers first (unchanged), then the claim. The claim never blocks or fails the powerup.

1. Read `eosio::voters` for `cheesepowerz` over the existing multi-endpoint RPC fallback.
2. Skip with a log line, not an error, if any of these hold:
   - no voter row, or neither `producers` nor `proxy` is set (not voting, nothing accrues)
   - `now < last_claim_time + 24h` — still in cooldown; the next daily run picks it up
   - `unpaid_voteshare` is zero
3. Otherwise push one transaction: `eosio::claimgbmvote { owner: "cheesepowerz" }`, authorised by `cheesepowerz@claimvote`.
4. Log the tx id, and re-read `last_claim_time` to confirm it advanced.
5. On failure: log it, print the tx error, and set a non-fatal warning. A claim error must not mark the powerup run failed, so `process.exitCode` is only set when the powerup itself failed.

Because the workflow already fires several times a day (00:17 plus retries) and later ticks exit early via the idempotency guard, the claim rides along with whichever tick actually does the work — roughly once every 24h. When the cooldown has not passed at that moment, it simply waits for the next day's run, as you asked. The existing `claim_only` escape hatch below lets you force one on demand.

## Guards

- **Cooldown read from chain, not from a local clock.** `last_claim_time` is the source of truth, so a missed day or a manual claim in your wallet can never double-claim or wedge the schedule.
- **Small safety margin.** The eligibility test uses `last_claim_time + 24h + 60s` so a run landing a few seconds early does not waste a transaction on a `nothing to claim` error.
- **Bounded work.** Exactly one claim attempt per run, no retry loop.
- **Dry run.** `DRY_RUN=1` prints the eligibility decision and the action it would send, and signs nothing.
- **Kill switch.** `CLAIM_VOTE_ENABLED=0` (repo variable or dispatch input) disables the phase entirely, leaving the powerup untouched.
- **Silently-off detection.** If setup is incomplete, the missing-authority error is logged verbatim so it shows up in the run log rather than failing quietly.

## Technical changes

- `scripts/daily-powerup/waxSign.ts` — add a generic `buildAction(session, { account, name, authorization, data })`. `buildTransferAction` hardcodes `cheeseburger`/`transfer`, so it cannot express the claim. Also allow `createSession` to be called with a different actor/permission so the claim can sign as `cheesepowerz@claimvote`.
- `scripts/daily-powerup/waxRpc.ts` — add `getVoterInfo(account)` returning `{ proxy, producers, unpaid_voteshare, last_claim_time }` from `eosio::voters`, using the existing `ENDPOINTS` fallback and timeout helper.
- `scripts/daily-powerup/claimVoteRewards.ts` (new) — the eligibility check and the single claim, exported as one function returning `{ skipped, reason?, txId? }` so `run.ts` just logs the outcome.
- `scripts/daily-powerup/run.ts` — call it after the powerup summary, inside `try/catch`, and print a `---- vote claim ----` section.
- `.github/workflows/daily-powerup.yml` — pass `CLAIM_VOTE_ENABLED`, `CLAIM_VOTE_ACCOUNT` (default `cheesepowerz`), `CLAIM_VOTE_PERMISSION` (default `claimvote`), and, only for Option B, `WAX_CLAIMVOTE_KEY`. Add a `claim_only` dispatch input to run just the claim for testing.
- `scripts/daily-powerup/README.md` — document the new env vars, the `cheesepowerz@claimvote` setup steps, and the 24h skip behaviour.

No CHEESEHub frontend code changes; the in-app `VoteRewardsManager` keeps working as it does now.

## What I need from you

Which key option do you want — A (reuse `WAX_DAILYPOWER_KEY`, no new secret) or B (separate `claimvote` key as a second secret)? I will write the code for whichever you pick; both need the `cheesepowerz@claimvote` permission plus `linkauth` created in your wallet before the first real claim can land.
