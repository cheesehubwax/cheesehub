

## Fix "Staked in [farm]" Badge Visibility + Nested Button Error

### Root causes

1. **Badge invisible**: The `extraBadge` wrapper at line 109 of `NFTGridCard.tsx` is `relative z-30` but NOT `absolute`. The badge children use `absolute` positioning (top-1 left-1, bottom-0) which positions them relative to the nearest positioned ancestor — the outer `<button>` — NOT the z-30 wrapper. So the `z-30` has no effect on the absolutely-positioned badge elements. The retry overlay at z-20 covers them.

2. **Nested `<button>` error**: The retry `<button>` (line 117) is inside the outer card `<button>` (line 98). Also, for staked-elsewhere NFTs, `FarmNFTCard` wraps `NFTGridCard` (a button) in a `<div onClick>` — but the card itself is still a button, and the retry state puts another button inside it.

### Changes

**File: `src/components/shared/NFTGridCard.tsx`**

1. Change the outer element from `<button>` to `<div role="button" tabIndex={0}>` to fix DOM nesting violations
2. Change the retry inner `<button>` to a `<div role="button">` as well
3. Make the `extraBadge` container `absolute inset-0 z-30 pointer-events-none` so it overlays the entire card above the retry/loading layers. The badge children's absolute positioning will now work correctly within this full-card overlay.

**File: `src/components/farm/NFTStaking.tsx`**

4. Remove the wrapping `<div className="relative opacity-60 cursor-pointer" onClick>` around NFTGridCard for staked-elsewhere cards — instead pass `onNavigateToFarm` directly as the `onToggle` handler to NFTGridCard, and apply opacity via `borderClass` or a new prop
5. Add `opacity-60` styling by wrapping just the outer div without an onClick (since NFTGridCard handles the click via onToggle)

### Technical detail

Current broken z-index stack:
```
outer <button> (position: relative)
  ├─ <div relative z-30>        ← NOT absolute, takes 0 height, children escape
  │    ├─ absolute top-1 left-1  ← positions relative to outer button, ignores z-30
  │    └─ absolute bottom-0      ← same problem
  ├─ <div w-full h-full>
  │    └─ retry <button> z-20    ← covers everything
```

Fixed:
```
outer <div role="button"> (position: relative)
  ├─ <div absolute inset-0 z-30 pointer-events-none>  ← full overlay
  │    ├─ absolute top-1 left-1   ← inherits z-30 stacking context
  │    └─ absolute bottom-0       ← inherits z-30 stacking context
  ├─ <div w-full h-full>
  │    └─ retry <div role="button"> z-20  ← below z-30 layer
```

### Files changed: 2

