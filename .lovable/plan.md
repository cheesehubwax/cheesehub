## Goal
Make Premium Account drop cards continuously pulsate with a yellow/cheese glow. Semi-Premium cards keep current behavior (glow only on hover).

## Changes

1. **`src/components/drops/DropCard.tsx`**
   - Add optional `highlight?: boolean` prop to `DropCardProps`.
   - When `highlight` is true, append classes that produce a constant yellow pulsing glow + border, e.g. `border-cheese/60 animate-pulse-glow shadow-[0_0_24px_hsl(var(--cheese)/0.45)]` (replacing the default `border-border/50 hover:border-primary/50 hover-cheese-glow`). When false, keep current classes unchanged.

2. **`src/components/drops/VirtualizedDropGrid.tsx`**
   - Add optional `highlight?: boolean` to both `VirtualizedDropGridProps` and `SimpleDropGrid` props, forwarded to each `<DropCard />`.

3. **`src/pages/Drops.tsx`**
   - On the Premium Accounts `<SimpleDropGrid>`, pass `highlight`. Leave the Semi-Premium grid untouched.

4. **`tailwind.config.ts`**
   - Add a `pulse-glow` keyframe + animation (cheese-yellow box-shadow oscillating between low and high intensity, ~2s ease-in-out infinite). Uses the existing `--cheese` HSL token so no new colors are introduced.

## Notes
- Uses existing `cheese` semantic token; no hard-coded colors.
- Hover behavior on Premium remains compatible — the pulsing glow continues regardless of hover.
- Purely presentational change; no logic, fetching, or classification rules touched.