# Daily CHEESE Powerup

Off-chain cron that powers up every `cheesecheese` staker with >= 5000 CHEESE
staked, plus the signing account itself, once per day at 00:00 UTC.

## What it does

1. **Self-powerup** — `power.chz` -> `cheesepowerz`, 1 CHEESE, memo `power.chz`,
   so the signing account has CPU to send the rest.
2. Reads every row of `cheesecheese::staketable`.
3. Keeps accounts with `staked >= 5000 CHEESE` (excludes the signer).
4. Pre-validates each account exists on-chain.
5. Sends `1.0000 CHEESE` from `power.chz` -> `cheesepowerz` with the staker's
   account name as the memo (CPU-only powerup).
6. Batches 50 transfers per tx. If a batch fails, bisects to drop bad account(s).
   Run exits non-zero if anything ultimately failed.

## Required env / secrets

| Name                    | Where                       | Purpose                                       |
| ----------------------- | --------------------------- | --------------------------------------------- |
| `WAX_SIGNER_ACCOUNT`    | GH repo variable (`vars`)   | Signing WAX account. Default: `power.chz`. |
| `WAX_SIGNER_PERMISSION` | GH repo variable (`vars`)   | Permission. Default: `dailypower`.            |
| `WAX_DAILYPOWER_KEY`    | GH repo **secret**          | WIF private key for the permission.           |
| `DRY_RUN`               | optional                    | `1` = no transactions, just print plan.       |
| `ALLOWLIST`             | optional                    | Comma-separated accounts to restrict to.      |

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
5. Keep `power.chz` topped up with a small baseline of staked WAX so the
   very first self-powerup tx can land each day.

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

`(eligible_stakers + 1) * 1.0000 CHEESE` per day. The script prints the
projected cost on every run.
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