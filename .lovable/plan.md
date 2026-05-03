# Fix CHEESE/USD price drift

## Problem

The CHEESE/USD figure in `CheesePriceBar` (and anywhere downstream of `useCheesePriceData`) reads `usd_price` directly from Alcor's `/api/v2/tokens` endpoint. Alcor computes that field by multiplying `system_price` (CHEESE/WAX) by an external WAX→USD feed (CoinGecko-style), not by the on-chain CHEESE↔WAXUSDC pool. That feed is frequently stale or off — right now Alcor reports:

- `CHEESE.system_price` = 1.81623 WAX
- `CHEESE.usd_price` = $0.01210
- `WAXUSDC.system_price` = 143.193 (i.e. 1 WAXUSDC ≈ 143 WAX → 1 WAX ≈ $0.00698)
- Implied CHEESE/USD via WAXUSDC = 1.81623 / 143.193 ≈ **$0.01268**

So the displayed value is consistently a few % lower than the real DEX-implied USD price, exactly what the user is seeing.

## Fix

Compute CHEESE/USD ourselves from the same `/tokens` payload (no extra request needed) using the WAXUSDC bridge:

```
waxUsdPrice  = 1 / WAXUSDC.system_price       // WAX→USD from on-chain pool
cheeseUsd    = CHEESE.system_price * waxUsdPrice
```

Fall back to `CHEESE.usd_price` only if WAXUSDC is missing or its `system_price` ≤ 0.

## Changes

**`src/hooks/useCheesePriceData.ts`**
- Look up the WAXUSDC token (`contract: 'eth.token'`, `ticker: 'WAXUSDC'`) alongside CHEESE.
- Derive `usdPrice` as `cheese.system_price / waxusdc.system_price` when available.
- Keep `waxPrice` as `cheese.system_price` (unchanged).
- Fall back to Alcor's `cheese.usd_price` if WAXUSDC isn't present.

**`src/components/home/CheesePriceBar.tsx`**
- The derived `waxUsdPrice` (used by `useCheeseTVL`) currently does `usdPrice / waxPrice`, which already simplifies to `1 / WAXUSDC.system_price` after the fix — so TVL math gets the corrected WAX/USD too. No code change needed there, but verify the resulting market cap / TVL still render correctly.

## Out of scope

- No changes to `useSwapTokens`, the swap widget, or the Alcor `/tokens` fetch — we just reinterpret the data we already have.
- No new network requests, no new caching.
