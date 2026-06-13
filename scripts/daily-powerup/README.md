# Daily CHEESE Powerup

Off-chain cron that powers up every `cheesecheese` staker with >= 5000 CHEESE
staked, plus the signing account itself, once per day at 00:00 UTC.

## What it does

1. Reads every row of `cheesecheese::staketable`.
2. Keeps accounts with `staked >= 5000 CHEESE` (excludes the signer).
3. Pre-validates each account exists on-chain.
4. Sends `1.0000 CHEESE` from `power.chz` -> `cheesepowerz` with the staker's
   account name as the memo (CPU-only powerup).
5. Batches 50 transfers per tx. If a batch fails, bisects to drop bad account(s).
   Run exits non-zero if anything ultimately failed.

`power.chz` relies on its own staked WAX (CPU/NET) to sign these transactions —
there is no self-powerup phase. Keep it staked with enough CPU to cover
~`ceil(eligible / 50)` transactions per day (plus headroom for bisect retries).

## Required env / secrets

| Name                    | Where                       | Purpose                                       |
| ----------------------- | --------------------------- | --------------------------------------------- |
| `WAX_SIGNER_ACCOUNT`    | GH repo variable (`vars`)   | Signing WAX account. Default: `power.chz`. |
| `WAX_SIGNER_PERMISSION` | GH repo variable (`vars`)   | Permission. Default: `dailypower`.            |
| `WAX_DAILYPOWER_KEY`    | GH repo **secret**          | WIF private key for the permission.           |
| `DRY_RUN`               | optional                    | `1` = no transactions, just print plan.       |
| `ALLOWLIST`             | optional                    | Comma-separated accounts to restrict to.      |
| `MIN_STAKED`            | optional GH repo variable   | Eligibility cutoff in CHEESE. Default `5000`. |
| `POWERUP_AMOUNT`        | optional GH repo variable   | CHEESE sent per account. Default `1.0000`. Sanity-capped to `(0, 100]`. Rounded to 4 decimals. |

## Tuning the amount / threshold

Two ways to change them without editing code:

1. **Persistent** — GitHub → repo Settings → Secrets and variables → Actions → Variables tab.
   Set `MIN_STAKED` and/or `POWERUP_AMOUNT`. Applied to every scheduled run.
2. **One-off** — Actions tab → "Daily CHEESE Powerup" → Run workflow.
   Fill `powerup_amount` and/or `min_staked` inputs; they override the repo variables for that
   run only. Leave empty to fall back to the repo variable, then the built-in default.

`POWERUP_AMOUNT` is rounded to 4 decimals (CHEESE precision) and rejected if it isn't a finite
number in `(0, 100]`. `MIN_STAKED` must be a finite number `>= 0`.

## One-time setup on the signing account

1. Create a new permission `dailypower` on `power.chz`, parent `active`,
   with a fresh keypair.
2. Link it to **only** `cheeseburger::transfer`:
   ```
   cleos set action permission power.chz cheeseburger transfer dailypower
   ```
3. Add the private key to GitHub repo secrets as `WAX_DAILYPOWER_KEY`.
4. Add repo variables `WAX_SIGNER_ACCOUNT=power.chz` and
   `WAX_SIGNER_PERMISSION=dailypower`.
5. Keep `power.chz` staked with enough WAX (CPU/NET) to cover the daily batch
   of transfers (~1 tx per 50 stakers, plus a margin for bisect retries).

## Manual / local invocation

```bash
cd scripts/daily-powerup
bun install

# Dry run (no signing required):
DRY_RUN=1 bun run run.ts

# Single-account live test:
WAX_DAILYPOWER_KEY=PVT_K1_... \
ALLOWLIST=someaccount \
bun run run.ts
```

## CHEESE budget

`eligible_stakers * 1.0000 CHEESE` per day. The script prints the projected
cost on every run.
*** Add File: scripts/daily-powerup/package.json
{
  "name": "daily-powerup",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "bun run run.ts"
  },
  "dependencies": {
    "@wharfkit/antelope": "^1.0.13",
    "@wharfkit/session": "^1.4.0",
    "@wharfkit/wallet-plugin-privatekey": "^1.1.0"
  }
}