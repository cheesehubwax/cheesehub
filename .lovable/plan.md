

## Fix Missing Greymass Fuel on Multiple Transaction Flows

### Problem
Three files call `session.transact({ actions })` **without** passing `{ transactPlugins: getTransactPlugins(session) }`, which means those transactions skip Greymass Fuel entirely. For Anchor users, this means no free CPU/NET sponsorship — transactions fail if the account has insufficient resources.

### Files to fix

**1. `src/components/wallet/StakeManager.tsx`** — 3 calls (stake, unstake, refund)
- Line 84: `session.transact({ actions })` → add `{ transactPlugins: getTransactPlugins(session) }`
- Line 106: same fix
- Line 119: same fix

**2. `src/components/wallet/AlcorFarmManager.tsx`** — 7 calls (claim, claim all, unstake, stake single, stake all positions, stake all, unstake expired)
- Lines 219, 245, 267, 294, 314, 354, 376: all missing the transactPlugins option

**3. `src/components/drops/ManageRamDialog.tsx`** — 2 calls (deposit RAM, withdraw RAM)
- Lines 66, 82: both missing the transactPlugins option

### Fix pattern
Every `session.transact({ actions })` becomes:
```ts
session.transact({ actions }, { transactPlugins: getTransactPlugins(session) })
```

Ensure `getTransactPlugins` is imported from `@/lib/wharfKit` in each file (already imported in StakeManager, needs checking in the others).

### Result
All transaction flows will pass through Greymass Fuel for Anchor sessions, restoring free CPU/NET sponsorship across the entire app.

### Files changed: 3

