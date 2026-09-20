# Make token locks work no matter what decimals people type

## What's going wrong

The lock form works out a token's decimal places by looking at the balance number it fetched. That balance comes back from the data service as a plain number, so trailing zeros are lost: a balance of `100.00000000 WAX` arrives as `100`, and the form concludes "no decimals". The lock is then sent as `1 WAX` instead of `1.00000000 WAX`, and the contract rejects it with the "Symbol mismatch / wrong amount of decimals" error your friend saw.

So this isn't really about what the user types — the form itself is guessing the decimals wrong. Typing more zeros wouldn't reliably fix it either.

## The fix

1. Read each token's real decimal setting from the blockchain itself (the token's own currency stats), instead of guessing from the balance figure. Cache it per token so the form stays fast.
2. Fall back to the built-in token list (which already has correct decimals for WAX, CHEESE, HOLE, etc.) when the chain lookup can't be reached, and only as a last resort to the digits in the balance string.
3. Format whatever the user types to that exact decimal count automatically — 1, 1.5, or 1.50000000 all become a valid amount. If someone types more decimals than the token allows, round down (never up past their balance).
4. Show the balance and available amount with the correct decimals in the dropdown and under it, so what's on screen matches what gets signed.
5. Block the obvious failure earlier: if the amount exceeds the balance, say so before signing instead of letting the chain reject it.
6. Apply the same treatment to the LP lock form, which has the identical guessing logic.

## Technical detail

- New helper (e.g. `src/lib/tokenPrecision.ts`): `getTokenPrecision(contract, symbol)` — reads `get_currency_stats` through the existing multi-endpoint RPC fallback (`waxRpcFallback`), parses the `max_supply` asset's decimal count, memoises results in a module map; falls back to `getTokenConfig(symbol)` from `src/lib/tokenRegistry.ts`, then to decimals present in the balance string.
- `src/components/locker/CreateLock.tsx`: resolve precision for the selected token (on selection, via state/react-query), format with `Math.floor(value * 10**p) / 10**p` then `toFixed(p)` so rounding is always down; use that single formatted string for both the `createlock` action and the `transfer` quantity; add an over-balance guard.
- `src/components/locker/CreateLiquidityLock.tsx`: same precision resolution and formatting (LP tokens on Defibox/Taco are 8 decimals but will now be read, not assumed).
- Optionally normalise balances shown in the dropdown by padding to the resolved precision.
- No contract or backend changes; Greymass Fuel transact plugins stay as they are.
