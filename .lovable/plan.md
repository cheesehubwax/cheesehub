# Fix invisible Compound All button

## Problem

The Compound All button only renders when `compoundableCount > 0` — at least one staked position whose farms pay out **both** of the pool's tokens, matched by exact `contract:symbol` strings. Two failure modes hide the button even when farms genuinely pay both tokens:

1. Exact string matching is brittle — if the pool's `tokenA`/`tokenB` contract or symbol is missing, differently-cased, or sourced differently from the farm's `rewardToken` (Alcor API vs chain fallback), the match fails silently.
2. When zero positions qualify, the button disappears entirely with no explanation.

## Fix

1. **Robust token matching** in the `compoundableCount` filter: normalize to uppercase, and when one side has a contract and the other doesn't, fall back to symbol-only matching. Apply the same normalization inside `planCompound` in `src/lib/alcorCompound.ts` so the dialog's own filtering can't disagree with the button count.
2. **Always show the button** whenever there are staked positions with incentives (`compoundPositions.length > 0`), even when 0 qualify — the dialog already lists skipped positions with reasons, so the user sees an explanation instead of nothing.
3. Keep the count badge (`Compound All (N)`) reflecting how many positions will actually compound.

## Technical details

- `src/components/wallet/AlcorFarmManager.tsx`: normalize match keys (uppercase symbol, contract when present) in the `compoundableCount` memo (~line 221); change render condition (~line 513) to `compoundPositions.length > 0`.
- `src/lib/alcorCompound.ts`: share a `tokenMatchKey(contract, symbol)` helper used by both files so button count and plan always agree.
- Verify: typecheck + focused vitest + preview build log; browser check on the farm manager view.
