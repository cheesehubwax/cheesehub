

## Fix: CHEESEUp Showing False Success When Transaction Doesn't Land On-Chain

### Problem
`PowerUpCard.tsx` shows the success dialog immediately after `session.transact()` resolves without verifying the transaction actually landed on-chain. The `result` object may resolve (wallet signed it) but the broadcast can silently fail — especially for users with no CPU where Fuel sponsorship didn't kick in or for Cloud Wallet users (who get NO Fuel plugin at all, per line 70 of `wharfKit.ts`).

### Root Cause
Line 136-143 of `PowerUpCard.tsx`: after `session.transact()` returns, it immediately shows the success dialog without checking `result.resolved?.transaction.id`. If `result.resolved` is undefined or the transaction ID is missing, the transaction didn't actually confirm.

### Fix

**`src/components/powerup/PowerUpCard.tsx`**

1. After `session.transact()`, check that `result.resolved?.transaction.id` exists before showing success
2. If no resolved transaction ID, show an error toast instead ("Transaction may not have been broadcast. Please check your account on waxblock.io")
3. Log the full result for debugging

**`src/lib/wharfKit.ts`** (optional but recommended)

4. Consider enabling Fuel for Cloud Wallet too — CHEESEUp is specifically meant to help users with no CPU. The `TransactPluginResourceProvider` may still work if Cloud Wallet supports the modified transaction. If not, at minimum surface a clear warning that Cloud Wallet users need some CPU first.

### Technical Detail
```
// Current (broken):
const result = await session.transact(...);
// immediately shows success dialog

// Fixed:
const result = await session.transact(...);
const txId = result.resolved?.transaction.id?.toString();
if (!txId) {
  toast.error("Transaction may not have confirmed", {
    description: "The wallet signed the transaction but it may not have been broadcast. Check waxblock.io for your account.",
    duration: 10000,
  });
  return;
}
// Only then show success dialog
```

### Files changed: 1 (PowerUpCard.tsx), possibly 2 if adjusting Fuel for Cloud Wallet

