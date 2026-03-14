

## Unified Transaction Success Dialog Across All dApps

### Problem
Currently only the CheeseWallet and MyDrips show the `TransactionSuccessDialog` with TX ID, copy, and block explorer link. All other dApps (farms, DAO, locker, powerup, null, banner ads, drops, drip creation, etc.) just show a basic toast on success.

### Approach
Create a **global TransactionSuccess context/provider** that `useWaxTransaction` triggers automatically. This means zero changes to the ~19 consumer components — they all get the dialog for free.

### Changes

**1. New file: `src/context/TransactionSuccessContext.tsx`**
- Create a React context with `showSuccess(title, description, txId)` and dialog state.
- Render a single `TransactionSuccessDialog` inside the provider.
- Export `useTransactionSuccess()` hook.

**2. Edit: `src/App.tsx`**
- Wrap the app with `<TransactionSuccessProvider>` (inside `WaxProvider`, outside `BrowserRouter`).

**3. Edit: `src/hooks/useWaxTransaction.ts`**
- Import and call `useTransactionSuccess().showSuccess(title, description, txId)` on successful transactions instead of showing a toast.
- Keep error handling as toast (errors don't need the dialog).
- Remove the success toast call; replace with `showSuccess(...)`.

This single hook change propagates to all 19 consumer files (farms, DAO, locker, powerup, null, drip, banner ads, etc.) without touching any of them.

