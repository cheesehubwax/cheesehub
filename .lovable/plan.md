# Rename "Alcor Swap" back to "CHEESESwap"

## Scope

Almost the entire codebase already uses "CHEESESwap" — the Disclaimer (§7.10), Terms of Use (`TermsContent.tsx`), and Admin Guide dApp registry all already say CHEESESwap with Alcor smart-contract attribution. Only one user-visible string was renamed to "Alcor Swap": the swap dialog title.

## Change

### `src/components/swap/CheeseSwapDialog.tsx`
- `DialogTitle` text: `Alcor Swap` → `CHEESESwap`
- Keep the existing `powered by Alcor Exchange` subtitle and the `Swap tokens using Alcor's smart contracts` description exactly as-is — that's the required attribution.

## Not changing

- `src/pages/Disclaimer.tsx` §7.10 header `CHEESESwap (Alcor Swap Widget)` — parenthetical clarifies the underlying widget, keep for legal clarity.
- `src/components/shared/TermsContent.tsx` — already uses "CHEESESwap" and correctly attributes swaps to `swap.alcor`.
- `src/pages/AdminGuide.tsx` — dApp entry already named `CHEESESwap` with `swap.alcor` contract and Alcor owner tag.
- Internal identifiers/comments/log strings (`alcorRouter.ts` header comment, `tvl.ts` `alcorSwap` key + console.warn, `fetchAlcorSwapCheeseTVL`) — non-user-facing, renaming them is churn with no product value and risks breaking TVL wiring.

## Verification

Open the swap dialog from the widget triggers and confirm the header reads **CHEESESwap** with the *powered by Alcor Exchange* attribution beneath it.
