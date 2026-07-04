## Goal
Update the CheeseSwap Multiroute panel so each hop shows the **pool pair** (two overlapping token icons) instead of a single token, matching Alcor's layout.

## Current behavior
`MultiRoutePanel.tsx` walks the chain of tokens and renders one `TokenLogo` per token, with the fee label between them. For a 2-hop route this shows 3 icons (in → mid → out).

## Target behavior (Alcor style)
For each hop in a split, render a **pair** of overlapping icons representing the pool's `tokenA` + `tokenB`, followed by the fee. The split percentage sits at the left of the row.

Row layout:

```text
[35%]  (◐◑) 0.3%  ---  (◐◑) 0.05%
        pair1            pair2
```

## Changes (single file: `src/components/swap/MultiRoutePanel.tsx`)

1. Restructure the render to iterate over `split.route` (pool IDs / hops) rather than the token chain.
2. For each hop, look up the pool in `pools` and render a small `TokenPair` element:
   - Two `TokenLogo`s (size `md`) inside a relative container.
   - Second logo uses negative left margin (e.g. `-ml-3`) and a subtle ring/border so they overlap like Alcor.
   - Order: use the directional walk already computed (`chain[idx]` = incoming token, `chain[idx+1]` = outgoing token) so the pair reads left-to-right along the route.
3. Render the split percent once at the start of the row (bright white, as today).
4. Fee label stays to the right of each pair, bright white.
5. Dashed white connector remains between hops (not after the last hop).
6. Keep loading skeleton and `hasError` early-return unchanged.
7. Keep the existing `chain` / `hopFees` computation — it already gives per-hop token A/B and fee.

## Technical notes
- No API, hook, or type changes.
- No changes to `CheeseSwapWidget.tsx`, `useAlcorPools.ts`, or `swapApi.ts`.
- Overlap styling via Tailwind: wrapper `flex items-center`, second logo `-ml-3 ring-2 ring-background rounded-full` so the overlap reads cleanly on the card background.