

## Fix: NFT disappearing after tooltip wrapper changes

### Problem
The `NFTCard` for staked-elsewhere NFTs now wraps in `<TooltipProvider><Tooltip><TooltipTrigger asChild><span className="inline-block w-full">...</span></TooltipTrigger></Tooltip></TooltipProvider>`. Inside a CSS Grid cell, this extra wrapping can cause the `aspect-square` button to lose its height because the `inline-block` span doesn't establish a proper containing block for aspect-ratio.

### Fix — `src/components/farm/NFTStaking.tsx`

**Move the tooltip wrapping _outside_ the `NFTCard` component and into `VirtualGrid`** — or simpler: change the span wrapper to have proper grid-compatible sizing.

Change the tooltip wrapper span from:
```tsx
<span className="inline-block w-full">{card}</span>
```
to:
```tsx
<span className="block w-full h-full">{card}</span>
```

Using `block` instead of `inline-block` and adding `h-full` ensures the span fills the grid cell, allowing the inner `aspect-square` button to render correctly.

This is a one-line CSS class change on the `<span>` element around line 221.

