# Configurable daily powerup amount & threshold

Make the two magic numbers in the daily powerup script tunable from GitHub without code changes. No frontend, no on-chain config.

## Today's hardcoded values

In `scripts/daily-powerup/run.ts`:
- `MIN_STAKED = 5000` (CHEESE) — eligibility cutoff
- `TRANSFER_AMOUNT = "1.0000 CHEESE"` — sent per account

## Changes

### 1. `scripts/daily-powerup/run.ts`
Replace the two constants with env-var reads, keeping current values as defaults so behavior is unchanged if nothing is set:

```ts
const MIN_STAKED = Number(process.env.MIN_STAKED ?? "5000");
const POWERUP_AMOUNT = Number(process.env.POWERUP_AMOUNT ?? "1.0000");
const TRANSFER_AMOUNT = `${POWERUP_AMOUNT.toFixed(4)} CHEESE`;
```

Validation (fail fast with a clear error before any tx):
- `MIN_STAKED` must be a finite number `>= 0`.
- `POWERUP_AMOUNT` must be a finite number `> 0` and `<= 100` (sanity cap to prevent fat-finger drain; adjustable).
- Log the resolved values on startup alongside the existing `signer=… dry_run=…` line.

Also update the projected-spend log line to use `POWERUP_AMOUNT` instead of the implicit `1.0000` (currently `(valid.length + 1).toFixed(4)` — change to `((valid.length + 1) * POWERUP_AMOUNT).toFixed(4)`).

### 2. `.github/workflows/daily-powerup.yml`
- Add two new `workflow_dispatch` inputs: `powerup_amount` and `min_staked` (both optional, free text).
- Pass `MIN_STAKED` and `POWERUP_AMOUNT` env vars to the run step, sourced from `vars.MIN_STAKED` / `vars.POWERUP_AMOUNT`, with the manual-dispatch inputs taking precedence when provided.

Env block becomes:
```yaml
MIN_STAKED: ${{ github.event.inputs.min_staked || vars.MIN_STAKED }}
POWERUP_AMOUNT: ${{ github.event.inputs.powerup_amount || vars.POWERUP_AMOUNT }}
```
Unset values stay empty strings, which the script treats as "use default".

### 3. `scripts/daily-powerup/README.md`
- Add `MIN_STAKED` and `POWERUP_AMOUNT` to the env/secrets table with their defaults (`5000`, `1.0000`).
- Add a short "Tuning" section explaining the two ways to change them:
  1. **Persistent:** GitHub → repo Settings → Variables → Actions → set `MIN_STAKED` / `POWERUP_AMOUNT`.
  2. **One-off:** Actions tab → "Daily CHEESE Powerup" → Run workflow → fill the inputs.
- Note the sanity cap on `POWERUP_AMOUNT`.

## Out of scope (per your answer)
- No admin UI in CHEESEHub.
- No on-chain config table.
- No per-tier amounts.
- No manual-trigger button in the app.

## Risk notes
- The 4-decimal CHEESE precision is preserved via `toFixed(4)`. Values with more precision (e.g. `1.23456`) get rounded — documented in the README.
- The `MAX_BISECT_OPS` safety cap and self-powerup phase are untouched, so a misconfigured amount can't blow past current batch protections.