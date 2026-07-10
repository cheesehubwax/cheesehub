Goal: In the multiroute panel, when the user hovers over a hop's overlapping token-logo pair, show a popup (tooltip) describing the pool pair in the format requested: e.g. "buzz (buzzingarden) / cheese(cheeseburger)".

Scope: Small UI-only change in the existing multiroute component.

Changes:
1. Edit `src/components/swap/MultiRoutePanel.tsx`.
   - Import `Tooltip`, `TooltipTrigger`, and `TooltipContent` from `@/components/ui/tooltip`.
   - For each hop, derive the two pool tokens (`a` and `b`) already available in `row.chain`.
   - Build a label string: `${a.symbol} (${a.contract}) / ${b.symbol} (${b.contract})`.
   - Wrap the hop's overlapping logo group (the `<div className="flex items-center">` containing the two `TokenLogo` components) with the tooltip, using `TooltipTrigger asChild` so the flex layout and negative-margin overlap remain unchanged.
   - Render the label inside `TooltipContent` positioned above the pair.

No other files need to change. The app already has a top-level `TooltipProvider` in `App.tsx`, so no extra provider is needed.

Validation: After implementation, hover over any pair logo in the multiroute panel and verify the popup shows the correct symbols and contracts.