## Issue

In the CHEESEWallet "Account" tab, token balances render via `b.balance.toLocaleString()` with no options, so JavaScript caps the display at 3 fraction digits. WAXWBTC (8-decimal precision) shows as `0.000` style, losing 5 digits of accuracy.

## Fix

Update the balance line in `src/components/wallet/WalletTransferDialog.tsx` (around line 373) to always render each token at its full registered precision:

```tsx
{b.balance.toLocaleString(undefined, {
  minimumFractionDigits: b.precision,
  maximumFractionDigits: b.precision,
})}
```

This matches the precision already stored per token in `tokenRegistry.ts` / `useAllTokenBalances` (e.g. WAXWBTC = 8, CHEESE = 4, WAX = 8) and mirrors the same pattern used elsewhere in this same file (lines 414, 425, 440).

## Scope

- Single file edit: `src/components/wallet/WalletTransferDialog.tsx` — only the account-list balance display.
- No changes to dropdowns, send form, portfolio totals, or other components (those already use precision or are intentionally truncated).
