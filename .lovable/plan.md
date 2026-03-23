

## Plan: Disable CHEESE payment when baselines are critical

### What this does

When the CHEESE/WAX price deviates too far from the contract's stored baseline (8%+ — the "red" threshold), the `cheesefeefee` contract will reject CHEESE payments on-chain. Currently the frontend doesn't detect this, so users select CHEESE, submit, and get a failed transaction. This change proactively disables the CHEESE option and shows a message recommending WAX instead.

### How it works

**1. `src/hooks/useCheeseFeePricing.ts`** — Add a baseline health check
- Fetch the `cheesefeefee` config table (reuse `fetchFeeFeeConfig`) and pool 1252 reserves (reuse `fetchPoolReserves`) alongside the existing price fetch
- Calculate the deviation between the live pool price and the stored baseline using `calcDeviation`
- Expose a new `isBaselineCritical: boolean` field (true when deviation >= 8%) on the returned pricing object

**2. `src/components/shared/FeePaymentSelector.tsx`** — Disable CHEESE when critical
- Read `isBaselineCritical` from `cheesePricing`
- When critical: disable the CHEESE radio button, dim the option visually, and show a yellow/amber notice below it: "CHEESE payments are temporarily unavailable due to price volatility. Please use WAX."
- Auto-select WAX if user had CHEESE selected and it becomes critical

### Files changed
1. `src/hooks/useCheeseFeePricing.ts` — add baseline deviation check, expose `isBaselineCritical`
2. `src/components/shared/FeePaymentSelector.tsx` — disable CHEESE option when critical, show recommendation message

