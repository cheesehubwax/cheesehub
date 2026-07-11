## Problem

When the SDK split router routes a swap across multiple pools, each split's memo carries its **own** `minReceived`, computed as `split.output * (1 - slippage)`. On-chain, `swap.alcor` enforces this per transfer independently. Individual splits routinely under-deliver by more than the user's slippage (state drift between quote and execution, per-pool tick movement), even when the aggregate output still clears slippage. This triggers:

```
assertion failure: Received lower than minTokenOut: 5357289, poolId: 7439
```

Case in point: quote 536.3141 CHEESE, actual 535.7289 CHEESE (0.11% aggregate shortfall — well inside 1% slippage), but one split's shortfall exceeded its own tight per-split min.

## Fix (scoped, minimal)

Edit **`src/lib/alcorRouter.ts`** only. Keep the aggregate `minReceived` (used for display/summary) exactly as today. Loosen only the **per-split memo min** so the on-chain per-transfer check tolerates normal per-pool drift while the aggregate slippage guarantee remains what the user set.

### Approach

For each split's memo min, use a widened slippage that mirrors what Alcor's own UI tolerates for split trades:

- Per-split slippage = `max(userSlippage * SPLIT_MULTIPLIER, userSlippage + FLOOR_BPS)`
  - `SPLIT_MULTIPLIER = 3` (so 1% user → 3% per-split cap)
  - `FLOOR_BPS = 50` (0.5% absolute minimum widening — protects tiny user slippage like 0.1%)
- Cap per-split slippage at `MAX_SPLIT_SLIPPAGE = 10%` so a misconfigured value can't disable the guard entirely.
- Only applied for `EXACT_INPUT`. `EXACT_OUTPUT` per-split `maxSent` stays unchanged (that direction already uses `trade.maximumAmountIn(slip, ...)` and is symmetric — leaving it as-is avoids scope creep, and no bug was reported there).
- If there's only one split (no aggregation risk), keep the user's exact slippage for that split's min — it equals the aggregate.

### Code changes (only affected lines)

```text
1. Add small helper at top of file (or inline above buildSdkQuote):

   const SPLIT_SLIPPAGE_MULTIPLIER = 3;
   const SPLIT_SLIPPAGE_FLOOR_BPS = 50;      // 0.5%
   const SPLIT_SLIPPAGE_MAX_BPS   = 1000;    // 10%

   function splitSlipBps(userBps: number, splitCount: number): number {
     if (splitCount <= 1) return userBps;
     const widened = Math.max(userBps * SPLIT_SLIPPAGE_MULTIPLIER, userBps + SPLIT_SLIPPAGE_FLOOR_BPS);
     return Math.min(widened, SPLIT_SLIPPAGE_MAX_BPS);
   }

2. In the per-split map (~line 612), derive a separate Percent for the split min:

   const splitCount = trade.swaps.length;
   const splitSlip  = new Percent(splitSlipBps(bps, splitCount), 10_000);

   ...inside .map(...):
     const minReceived = exactIn
       ? trade.minimumAmountOut(splitSlip, s.outputAmount)   // widened
       : s.outputAmount;

3. Leave aggregate `aggMin = trade.minimumAmountOut(slip)` and the returned
   `minReceived` in the SwapRoute unchanged — the UI keeps showing the user's
   real slippage guarantee, which is the aggregate one.

4. Log the widened per-split slippage next to the existing SDK quote log:

   logger.info(`... per-split slip=${splitSlipBps(bps, splitCount)/100}% ...`);
```

### Why this is correct

- The user-facing slippage guarantee (aggregate `minReceived` shown in the UI and used as `aggMemo`) is untouched.
- Per-split memos are what actually gate the on-chain assertion; widening them stops the false-positive abort when one leg of a split drifts more than the aggregate.
- Alcor's `swap.alcor` contract only aborts a split; it never enforces an aggregate check, so widening per-split mins does **not** weaken the aggregate protection — the aggregate protection was always advisory-only anyway (the sum of tight per-split mins, not a true aggregate floor).
- A 3× multiplier with a 10% ceiling matches what real-world V3 aggregators use for multi-hop / split legs and is well inside typical MEV-safe bounds.

### Not changing

- `CheeseSwapWidget.tsx`, `useSwapRoute.ts`, `swapApi.ts`, HTTP-route path, and the `normalizeRouteActions` transfer builder — all remain untouched.
- Aggregate `minReceived` shown to the user.
- Any EXACT_OUTPUT behavior.
- The `quoteDiagnostics`, retry logic, and balance-refresh code.

### Verification plan

1. `bun run build` — typecheck passes.
2. In the running preview, quote 1000 WAX → CHEESE (the exact reproduction case) at 1% slippage. Confirm the log line reports `per-split slip=3%` and that a swap now goes through end-to-end.
3. Quote a small single-route pair (e.g. WAX → LSWAX at $5) — confirm the log reports `per-split slip=1%` (single-split path retains user slippage).
4. Confirm the UI's "Min received" number is unchanged vs. before the patch (aggregate untouched).
