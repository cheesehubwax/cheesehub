## Goal

Remove the self-powerup step so `power.chz` no longer sends itself 1 CHEESE to `cheesepowerz` at the start of each run. The account will instead rely solely on its own staked WAX (CPU/NET) to cover the daily batch of transfers.

## Changes

### 1. `scripts/daily-powerup/run.ts`
- Delete the "Phase 0: self-powerup" block entirely (the `selfStats` run, the 3s sleep, and the abort-on-failure check).
- Remove `SIGNER` from the powerup target memo flow — it's already excluded from `filterEligible`, so no list change needed.
- Update the projected-spend log: `valid.length * POWERUP_AMOUNT` (drop the `+ 1`).
- Update the summary log: `stats.txIds.length` total txs (drop "+ self-powerup"), and `sent.length * POWERUP_AMOUNT` for cheese spent.
- Remove the `self-powerup tx=...` line from the tx ids dump.
- DRY_RUN log: remove the "self-powerup action would be" block.

### 2. `scripts/daily-powerup/README.md`
- "What it does" section: drop step 1 (self-powerup) and renumber.
- CHEESE budget: change to `eligible_stakers * 1.0000 CHEESE`.
- One-time setup step 5: reword from "topped up with a small baseline of staked WAX so the very first self-powerup tx can land" to "kept staked with enough WAX (CPU/NET) to cover the daily batch of transfers (~1 tx per 50 stakers)".

### 3. No changes to
- `waxSign.ts`, `waxRpc.ts`, `filterStakers.ts`, `package.json`, the workflow yaml, or any frontend code.

## Operator-facing note

Without self-powerup, `power.chz` must always carry enough staked WAX to sign every batch (≈ `ceil(eligible/50)` transactions, plus bisect retries). If CPU runs out mid-run the remainder fails until the next day. Recommend keeping a comfortable CPU stake margin.

Confirm and I'll switch to build mode and apply.