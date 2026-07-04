## Goal

Add an Alcor-style expandable "Multiroute" panel to the CheeseSwap widget that shows, for each split of the swap, the chain of tokens the trade routes through and the fee tier of each hop.

## Reference (Alcor)

For a 1000 WAX → CHEESE swap Alcor shows two rows under "Multiroute":

```
50%   WAX → WAXUSDC (0.3%) → CHEESE (0.3%)
50%   WAX → LSWAX  (0.05%) → WAXUSDC (0.3%) → CHEESE
```

Each row = one split (percent of input), followed by the ordered sequence of tokens with the pool fee shown next to each hop.

## Data source

Alcor's route response already carries everything needed:

```json
{
  "route": [314, 5181],
  "swaps": [
    { "route": [314, 5181], "percent": 100, "input": "1000... WAX", "output": "551.25 CHEESE", ... }
  ]
}
```

Each pool ID resolves via `GET /api/v2/swap/pools/{id}` and returns `tokenA`, `tokenB`, and `fee` (fee is basis-points × 10, e.g. `3000` = 0.3%, `500` = 0.05%).

Direction of a hop is derived by walking from the current token: if `pool.tokenA.id === currentTokenId` the next token is `tokenB`, otherwise `tokenA`.

## Changes

### 1. `src/lib/swapApi.ts`
- Extend `SwapRoute` with `swaps: SwapSplit[]` where each `SwapSplit` = `{ percent: number; route: number[]; input: string; output: string; minReceived: string }`.
- Parse `data.swaps` in `fetchSwapRoute` (fallback to a single synthetic split from `route`/`input`/`output` if `swaps` is missing, for backward safety).
- Add `fetchAlcorPool(id: number, signal?)` returning `{ id, fee, tokenA: {id,symbol,contract,decimals}, tokenB: {...} }` from `/api/v2/swap/pools/{id}` (typed, minimal shape).

### 2. `src/hooks/useAlcorPools.ts` (new)
- `useAlcorPools(ids: number[])` — batches `useQueries` over unique pool IDs.
- `staleTime: 5 min`, `gcTime: 30 min` (pool metadata rarely changes for routing display).
- Returns `{ pools: Map<number, AlcorPool>, isLoading }`.

### 3. `src/components/swap/MultiRoutePanel.tsx` (new)
- Props: `route: SwapRoute`, `tokenIn: SwapToken`, `tokenOut: SwapToken`.
- Collects all pool IDs across `route.swaps[].route`, calls `useAlcorPools`.
- For each split:
  - Compute ordered token chain starting from `tokenIn`, walking pools by direction rule; ends at `tokenOut`.
  - Render one row: split percent on the left, then `TokenLogo` + fee badge for each hop, joined by dashed connector lines to match Alcor's look.
- Uses existing `TokenLogo` component and `text-cheese` / `bg-secondary` tokens — no new colors.
- Skeleton row while pools load; hide silently if any pool fetch fails (fallback to nothing rather than a broken diagram).

### 4. `src/components/swap/CheeseSwapWidget.tsx`
- Inside the existing route-details collapsible block (already toggled by `showRouteDetails`), append `<MultiRoutePanel route={route} tokenIn={tokenIn} tokenOut={tokenOut} />` below "Min. Received".
- No change to the current header/summary line or button logic.

## Technical notes

- Fee formatting: `formatFee(fee) = (fee / 10000).toString() + "%"` → `3000 → "0.3%"`, `500 → "0.05%"`, `100 → "0.01%"`.
- Direction walk pseudocode:
  ```
  current = tokenIn.id  // e.g. "wax-eosio.token"
  for id in split.route:
    p = pools.get(id)
    next = p.tokenA.id === current ? p.tokenB : p.tokenA
    hops.push({ from: current, to: next, fee: p.fee })
    current = next.id
  ```
- Percent already comes as a number (e.g. `50`); display as `${percent}%`.
- No new dependencies. No changes to swap execution, memos, or transaction flow.

## Out of scope

- No live re-fetching of pool prices — this is display-only routing metadata.
- No changes to the swap button, slippage, or route summary math.
- No mobile layout redesign beyond the panel wrapping naturally (rows use `flex-wrap`).