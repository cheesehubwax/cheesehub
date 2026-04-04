

## Fix Farm + DAO Creation: Missing WAXDAO Fee Transfer Step

### Root Cause

Comparing against the working GitHub reference, both `CreateFarm.tsx` and `CreateDao.tsx` are missing a critical step. The correct flow is a **4-action sequence**:

1. Send CHEESE (or WAX) to `cheesefeefee` — contract sends WAXDAO back to user inline
2. `assertpoint` — initialize points row
3. **Transfer WAXDAO to the target contract** (e.g. `farms.waxdao` or `dao.waxdao`) with a fee memo — this is the actual fee payment
4. `createfarm` / `createdao`

Our code is missing step 3 entirely. Without the WAXDAO transfer, the contract has no record of fee payment and rejects with "You don't have a points balance."

Additionally, the WAX path currently sends WAX directly to `farms.waxdao` using the old `buildFarmCreationFeeWaxAction` / `buildDaoCreationFeeAction`. The GitHub reference routes WAX through `cheesefeefee` first (which returns WAXDAO), then pays WAXDAO to the target contract — same 4-step flow.

### Changes

**1. `src/components/farm/CreateFarm.tsx`**
- Import `buildWaxdaoFeeAction`, `buildWaxPaymentAction` from `@/lib/cheeseFees`
- Import and use `useWaxdaoFeePricing` hook for WAXDAO amount calculation
- Replace current 2-action payment logic with the correct 4-action sequence:
  - **CHEESE path**: `cheesePayAction` → `assertpoint` → `waxdaoFeeAction(farms.waxdao, "|create_farm|")` → `createfarm`
  - **WAX path**: `waxPayAction(cheesefeefee)` → `assertpoint` → `waxdaoFeeAction(farms.waxdao, "|create_farm|")` → `createfarm`
- Add availability checks for `waxdaoPricing.isAvailable`
- Remove unused `buildFarmCreationFeeWaxAction` import

**2. `src/components/dao/CreateDao.tsx`**
- Import `buildWaxdaoFeeAction`, `buildWaxPaymentAction` from `@/lib/cheeseFees`
- Import and use `useWaxdaoFeePricing` hook
- Replace current payment logic with the correct 5-action sequence (matching GitHub exactly):
  - **CHEESE path**: `cheesePayAction` → `assertpoint` → `waxdaoFeeAction(dao.waxdao, "|dao_payment|")` → `createdao` → `setprofile`
  - **WAX path**: `waxPayAction(cheesefeefee)` → `assertpoint` → `waxdaoFeeAction(dao.waxdao, "|dao_payment|")` → `createdao` → `setprofile`
- Add availability checks for both pricing hooks
- Remove unused `buildDaoCreationFeeAction` import

### Files changed: 2

