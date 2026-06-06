# Daily CHEESE Powerup Cron — Plan (revised)

Same as the previously approved plan, with the **signing account changed from `cheeselardr1` to `power.chz`**. The user will create and fund `power.chz` separately.

Run a scheduled GitHub Actions workflow once per day at **00:00 UTC** that:
1. **Self-powerup**: first action of the run is `power.chz` sending `1.0000 CHEESE` → `cheesepowerz` with memo `power.chz` so it has CPU to sign the rest of the batch.
2. Reads every row of `cheesecheese::staketable`.
3. Filters to rows where `staked >= 1000.0000 CHEESE`.
4. For each eligible account, sends `1.0000 CHEESE` from **power.chz** → **cheesepowerz** with the staker account name as the memo (CPU-only powerup; confirmed against `src/components/powerup/PowerUpCard.tsx` line 121).
5. Batches actions into transactions, skips broken accounts via bisect, logs results.

No app/UI changes. Everything lives in `.github/workflows/daily-powerup.yml` and `scripts/daily-powerup/`.

---

## What changes vs. the approved plan

- `WAX_SIGNER_ACCOUNT` default → `power.chz` (was `cheeselardr1`).
- Self-powerup memo → `power.chz`.
- Permission setup commands are run against `power.chz`.
- README and code defaults updated accordingly.
- Everything else (batching, bisect, multi-endpoint RPC, GH Actions workflow, secrets layout) is unchanged.

The signer account is fully parameterized via the `WAX_SIGNER_ACCOUNT` env var, so the actual code change is small.

---

## Files to update

```text
scripts/daily-powerup/run.ts          # default SIGNER -> "power.chz"
scripts/daily-powerup/README.md       # all cheeselardr1 references -> power.chz
.github/workflows/daily-powerup.yml   # no code change; just set the repo var to power.chz
```

No other files need editing. `waxRpc.ts`, `waxSign.ts`, `filterStakers.ts`, `package.json`, and `tsconfig.json` are signer-agnostic.

---

## One-time setup on `power.chz` (you do this manually after creating + funding it)

1. Create the WAX account `power.chz` and fund it with:
   - A small permanent stake of **WAX** for CPU/NET (so the first self-powerup tx of each day can land).
   - Enough **CHEESE** balance to cover `(eligible_stakers + 1) × 1.0000` per day, with comfortable headroom.
2. Create a new permission `dailypower` on `power.chz`, parent `active`, with a fresh keypair.
3. Link it to **only** `cheeseburger::transfer`:
   ```
   cleos set action permission power.chz cheeseburger transfer dailypower
   ```
4. GitHub repo **secret**: `WAX_DAILYPOWER_KEY` = the WIF private key for `dailypower`.
5. GitHub repo **variables** (not secrets):
   - `WAX_SIGNER_ACCOUNT = power.chz`
   - `WAX_SIGNER_PERMISSION = dailypower`

Restricting the permission to `cheeseburger::transfer` means a leaked key can only move `cheeseburger` tokens from `power.chz` — nothing else (no staking, no NFTs, no account changes).

---

## Validation before going live

1. Manually run via `workflow_dispatch` with `dry_run=1`:
   - Confirms `staketable` is read, filter is correct, and prints the would-be self-powerup + first batch.
2. Live test with `ALLOWLIST=<one_test_account>`:
   - Validates signing works and that the self-powerup correctly gives `power.chz` CPU before the test transfer.
3. Remove the allowlist; cron takes over at the next 00:00 UTC.

---

## What this plan deliberately still does NOT do

- No on-chain contract.
- No UI / admin page for schedule management.
- No persistence of per-day history (GH Actions run logs are the audit trail).
- No `cheeseburner` interaction.
