

## Fix Missing `assertpoint` in CHEESE Payment Flow

### Root Cause

The `assertpoint` action is **only included in the WAX payment path**, but it's needed for ALL payment methods. This action creates the user's row in the `farms.waxdao` points table. Without it, when the `cheesefeefee` contract tries to credit points via inline transfer, there's no row to credit, so `createfarm` fails with "You don't have a points balance."

**CreateFarm.tsx (lines 177-182) — current broken code:**
```ts
if (paymentMethod === "cheese") {
  actions.push(buildCheesePaymentAction(...));     // ← no assertpoint!
} else {
  actions.push(buildAssertPointAction(accountName)); // ← only WAX gets it
  actions.push(buildFarmCreationFeeWaxAction(accountName));
}
```

**Bonus bug found in CreateDao.tsx (lines 119-124):** The CHEESE path pushes NO payment action at all — only WAX gets fee actions. CHEESE-paying DAO creators send zero fee to the contract.

### Fix

**1. `src/components/farm/CreateFarm.tsx`** — Add `assertpoint` before the CHEESE payment action:
```ts
if (paymentMethod === "cheese" && cheesePricing.isAvailable) {
  actions.push(buildAssertPointAction(accountName));  // ADD THIS
  actions.push(buildCheesePaymentAction(...));
} else {
  actions.push(buildAssertPointAction(accountName));
  actions.push(buildFarmCreationFeeWaxAction(accountName));
}
```

**2. `src/components/dao/CreateDao.tsx`** — Add `assertpoint` AND the CHEESE payment action for the cheese path:
```ts
if (paymentMethod === "cheese" && cheesePricing.isAvailable) {
  actions.push(buildAssertPointAction(accountName));
  actions.push(buildCheesePaymentAction(accountName, cheesePricing.formattedForTx, "dao", daoName));
} else if (paymentMethod === "wax") {
  actions.push(buildAssertPointAction(accountName));
  actions.push(buildDaoCreationFeeAction(accountName));
}
```
Also add the missing `buildCheesePaymentAction` import from `@/lib/cheeseFees` and `useCheeseFeePricing` hook.

### Files changed: 2

