

## Fix: CHEESE Collected stat on CheeseDrop page

### Problem
The "CHEESE Collected" stat currently sums `current_claimed` from the `nfthivedrops` drops table — that's the **number of NFTs claimed**, not the amount of CHEESE tokens received. The value shows 0 because there's no CHEESE amount in that field.

### Solution
Query **Hyperion** for actual CHEESE token transfers sent **to** the `nfthivedrops` account (i.e., purchase payments), from March 24, 2025 onward. This follows the exact same pattern already used in `cheeseNullBreakdown.ts` and `fetchPowerupLeaderboard.ts`.

### Changes

**`src/services/atomicApi.ts`** — Rewrite `fetchCheeseDropStats` to:
1. Keep the existing drops table query for `activeDrops` count (that part works fine)
2. Replace the `totalSold` calculation with a Hyperion query:
   - Endpoint: `https://wax.eosusa.io/v2/history/get_actions`
   - Params: `act.account=cheeseburger&act.name=transfer&transfer.to=nfthivedrops&after=2025-03-24T00:00:00.000Z&limit=1000&skip=0`
   - Paginate with `skip` in batches of 1000 (same pattern as `fetchPowerupLeaderboard.ts`)
   - Sum `act.data.quantity` amounts (parse the `"1234.0000 CHEESE"` string)
   - Use fallback Hyperion endpoints: `wax.eosusa.io`, `wax.eosphere.io`
3. Return `{ activeDrops, totalSold }` where `totalSold` is now the summed CHEESE amount

### Files changed: 1

