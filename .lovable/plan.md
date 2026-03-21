

## Fix: usePurchaseDrop missing critical transaction infrastructure

### What happened

The transaction `ea943b8d...` confirms the purchase went through on-chain. The CHEESE was deposited to `nfthivedrops`, but the NFT appears stuck in the contract. This points to the `usePurchaseDrop` hook's broken transaction handling — specifically the missing `transactPlugins` (Greymass Fuel resource provider) which can cause partial or malformed transaction broadcasting.

### Bugs in `usePurchaseDrop.ts` vs the proven `WaxContext.claimDrop`

| Issue | `usePurchaseDrop` (Cart) | `WaxContext.claimDrop` (Working) |
|-------|-------------------------|----------------------------------|
| Resource provider (Fuel) | Missing | `getTransactPlugins(session)` |
| Balance refresh after tx | Never called | `refreshBalance()` |
| Modal cleanup on error | Missing | `closeWharfkitModals()` |
| Success confirmation | None (silent) | Shows TX ID dialog |
| Error toast | Generic via CartDrawer | Proper destructive toast |

### Fix

**File: `src/hooks/usePurchaseDrop.ts`**

- Import `getTransactPlugins`, `closeWharfkitModals` from `@/lib/wharfKit`
- Pass `{ transactPlugins: getTransactPlugins(session) }` as second arg to both `session.transact()` calls
- Call `refreshBalance()` from WaxContext after successful purchase
- Add `closeWharfkitModals()` in catch and finally blocks

**File: `src/components/drops/CartDrawer.tsx`**

- Import and use `useTransactionSuccess` from `@/context/TransactionSuccessContext`
- After all items purchased successfully, call `showSuccess()` with the last transaction ID so the user gets a confirmation dialog with the TX ID and explorer link
- Call `refreshBalance()` after purchase loop

### Summary
- 2 files changed
- Aligns the Cart purchase path with the battle-tested WaxContext transaction pattern

