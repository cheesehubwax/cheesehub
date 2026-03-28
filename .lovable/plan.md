

## Add Terms of Use Confirmation Popup Before Key Transactions

### Overview
Reusable confirmation dialog requiring users to acknowledge Terms of Use before executing certain transactions. Once confirmed per session, it won't show again.

### New Files (2)

**`src/components/shared/TermsConfirmationDialog.tsx`**
- AlertDialog with checkbox: "I have read and agree to the Terms of Use"
- Link to `/terms` (new tab)
- Confirm button disabled until checkbox checked
- On confirm: sets `sessionStorage.setItem("terms_accepted", "true")` and calls `onConfirm()`

**`src/hooks/useTermsConfirmation.ts`**
- `requireTerms(callback)` — checks sessionStorage; if accepted, calls callback immediately; otherwise opens dialog
- `termsDialogProps` — props to spread onto the dialog component

### Integration Points (9 files modified)

Each file: import hook + component, wrap submit handler with `requireTerms()`, render dialog.

| File | Trigger |
|------|---------|
| `CreateLock.tsx` | token lock submit |
| `CreateLiquidityLock.tsx` | LP lock submit |
| `CreateFarm.tsx` | farm creation |
| `CreateDao.tsx` | DAO creation |
| `CreateDrip.tsx` | drip creation |
| `CartDrawer.tsx` | purchase (only if cart contains `cheesenftwax` collection items) |
| `TreasuryDeposit.tsx` | treasury deposit |
| `RentSlotDialog.tsx` | `handleRent` — single slot rental |
| `BulkRentDialog.tsx` | `handleBulkRent` — bulk slot rental |

### Files Changed: 11
- `src/components/shared/TermsConfirmationDialog.tsx` (new)
- `src/hooks/useTermsConfirmation.ts` (new)
- `src/components/locker/CreateLock.tsx`
- `src/components/locker/CreateLiquidityLock.tsx`
- `src/components/farm/CreateFarm.tsx`
- `src/components/dao/CreateDao.tsx`
- `src/components/drip/CreateDrip.tsx`
- `src/components/drops/CartDrawer.tsx`
- `src/components/dao/TreasuryDeposit.tsx`
- `src/components/bannerads/RentSlotDialog.tsx`
- `src/components/bannerads/BulkRentDialog.tsx`

