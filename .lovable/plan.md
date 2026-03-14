

## Fix: Tooltip not showing on disabled staked-elsewhere NFTs + add farm link

### Problem
The NFT card is a `<button disabled>`, which doesn't receive hover/pointer events in most browsers, so the Radix tooltip never triggers. Additionally, the user wants a clickable link to navigate to the farm where the NFT is staked.

### Changes — `src/components/farm/NFTStaking.tsx`

**1. Fix tooltip on disabled button**
Wrap the disabled button in a `<span>` so the tooltip trigger element still receives pointer events. Change from:
```tsx
<TooltipTrigger asChild>{card}</TooltipTrigger>
```
to:
```tsx
<TooltipTrigger asChild>
  <span className="inline-block">{card}</span>
</TooltipTrigger>
```

**2. Add link to the staked farm in tooltip**
Update the `TooltipContent` to include a clickable link:
```tsx
<TooltipContent side="top" className="max-w-[220px]">
  <p className="text-xs">
    <AlertTriangle className="h-3 w-3 inline mr-1 text-amber-500" />
    Already staked in{" "}
    <a href={`/farm/${stakedInFarm}`} className="font-semibold text-cheese underline hover:text-cheese/80">
      {stakedInFarm}
    </a>.
    Unstake there first.
  </p>
</TooltipContent>
```

Use an `<a>` tag (or React Router `Link`) so users can click through to the farm to unstake. The small "in: farmname" text at the bottom of the card (line 207) should also become a link for convenience.

