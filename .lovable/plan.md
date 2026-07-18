## Goal
1. Show a **HOLE/CHEESE** price card on the homepage price bar, centered on a new row beneath Market Cap / TVL.
2. Add **HOLE** (`hole.cheese`, precision 8) as a first-class token across the swap widget, token selector, and token registries.

## Data source (price)
Alcor pool `11051` (CHEESE ↔ HOLE): `GET https://wax.alcor.exchange/api/v2/swap/pools/11051`.
`priceB` = CHEESE per 1 HOLE → displayed as `1 HOLE = {priceB.toFixed(4)} CHEESE`.

## Logo handling
Alcor doesn't yet host a HOLE logo. Everywhere HOLE renders (price card, TokenSelector, swap inputs, drop price picker), use the existing **`TokenLogo`** component (`src/components/TokenLogo.tsx`), which already:
- Attempts `getTokenLogoUrl(contract, symbol)`.
- On 404 falls back to the standard placeholder: a `cheese/20` circle with the first letter ("H") in cheese-yellow.
- Caches misses via `tokenLogoMisses` so we don't re-request.

No new asset is added; when Alcor uploads the real logo, it will start rendering automatically.

## Changes

### Price card
1. **New hook** `src/hooks/useCheeseHolePrice.ts`
   - `useQuery(["cheese-hole-price"], fetch pool 11051, staleTime 60s, refetchOnWindowFocus false)`.
   - Returns `{ cheesePerHole, isLoading, isFetching, refetch }` from `priceB`.

2. **`src/components/home/CheesePriceBar.tsx`**
   - Wrap existing 4-card + refresh flex row in an outer column container.
   - Add a second centered row containing a single card styled identically (same gradient/border), with:
     - Icon: `<TokenLogo contract="hole.cheese" symbol="HOLE" size="md" />` (placeholder "H" until Alcor hosts the logo).
     - Label: `HOLE/CHEESE`.
     - Value: `1 HOLE = {cheesePerHole.toFixed(4)} CHEESE` (Skeleton while loading).
     - No trade button.
   - Wire the new hook's `refetch` / `isFetching` into `refreshAll` and the shared spinner state.

### HOLE as a swap token
The Alcor `/tokens` endpoint (source of `useSwapTokens`) already returns HOLE, so TokenSelector list, balances, and routing pick it up automatically. Explicit additions:

3. **`src/lib/swapApi.ts`**
   - Append `"HOLE"` to `POPULAR_TICKERS` so it appears in the swap widget's popular-tokens strip.
   - Add `HOLE: "hole.cheese"` to `PREFERRED_CONTRACTS` for deterministic default selection.

4. **`src/lib/tokenRegistry.ts`**
   - Add `{ symbol: 'HOLE', contract: 'hole.cheese', precision: 8, displayName: 'HOLE' }` to `WAX_TOKENS`.

5. **`src/lib/alcorRouter.ts`**
   - Add `'hole-hole.cheese'` to `ROUTE_COVERAGE_HUB_KEYS` (or the WAX-side pair-seeder equivalent used for `cheese-cheeseburger`) so WAX→HOLE / HOLE→WAX surface the CHEESE-bridged split route. Confirm exact handling by re-reading `alcorRouter.ts` at build time and mirror the CHEESE pattern.

6. **TokenSelector / Swap inputs** — no code changes needed; they already render tokens via `TokenLogo`, which supplies the placeholder automatically.

## Out of scope
- USD price for HOLE.
- Custom HOLE branding asset (placeholder handled by existing `TokenLogo` fallback).
- Adding HOLE to CHEESENull / Farm reward selectors / DAO governance token lists.

## Verification
- `bun run build` clean.
- Homepage: new card centered under the existing row; value populates from pool 11051; icon shows "H" placeholder.
- Swap widget: HOLE appears in the popular strip and TokenSelector search with "H" placeholder; WAX → HOLE returns a valid multi-leg route through CHEESE.
- CHEESEDrops price selector: HOLE listed and formats amounts at 8 decimals.