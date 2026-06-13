# Fix: powerup script reads wrong staketable fields

## Root cause

The on-chain row shape of `cheesecheese::staketable` is:

```json
{ "staker": "m23qs.wam", "cheesestaked": "50000.0000 CHEESE", "staketime": ..., "unstaketime": 0 }
```

But `scripts/daily-powerup/filterStakers.ts` reads `row.account` and `row.staked`. Both are `undefined`, so every row is filtered out — that's why the live run logged `eligible: 0` and spent no CHEESE, even though `m23qs.wam` is staked 50,000.

The transfer memo also needs to be the staker's name. Today it's correctly passed from the filter output, so once the field names are fixed everything flows through.

## Changes

1. `scripts/daily-powerup/filterStakers.ts`
   - Update the `StakeRow` interface to `{ staker: string; cheesestaked: string }`.
   - Read `row.staker` and `row.cheesestaked` (instead of `row.account` / `row.staked`).
   - Keep `EligibleStaker` shape (`{ account, staked }`) so the rest of the pipeline is unchanged — map `staker -> account`, `cheesestaked -> staked`.

2. `scripts/daily-powerup/waxRpc.ts`
   - In `fetchTableAll`, the pagination fallback reads `last.account` for `lower_bound`. Change it to read `last.staker` (with a generic type fallback) so paging works if the table ever exceeds one page. Not strictly required today (15 rows, one page), but worth fixing while we're here.

3. `scripts/daily-powerup/run.ts` — no changes needed; it consumes `EligibleStaker.account`.

4. `scripts/daily-powerup/README.md`
   - Add a short "Table schema" note documenting that rows are `{ staker, cheesestaked }` so future edits don't regress this.

## Verification

After applying, re-run the workflow with `allowlist=m23qs.wam` and `dry_run=1`. Expected log:

```
[powerup] fetched 15 rows
[powerup] eligible (>= 5000 CHEESE): N
[powerup] allowlist filter applied -> 1
[powerup] valid stakers: 1
[powerup] projected CHEESE spend: 1.0000
[powerup] DRY_RUN=1 set; skipping all transactions.
[powerup] first batch (up to 50): ["m23qs.wam"]
```

Then re-run with `dry_run=0` and `allowlist=m23qs.wam` for the real single-account test.
