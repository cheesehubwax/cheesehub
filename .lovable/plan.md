

## Make "Staked Elsewhere" NFTs Clickable to Navigate to Other Farm

### Summary
The cross-farm detection (`globallyStakedMap`) and visual treatment (amber border, warning icon) already exist in `FarmNFTCard` (lines 82-126). The fix: remove `disabled`, add opacity dimming, add a visible "Staked in [farm]" label, and make clicking navigate to that farm.

### Changes — `src/components/farm/NFTStaking.tsx`

1. **Add `useNavigate`** import from `react-router-dom`

2. **Update `FarmNFTCardProps`** to accept an `onNavigateToFarm?: () => void` callback

3. **Update the staked-elsewhere branch** (lines 85-116):
   - Remove `disabled` prop from `NFTGridCard`
   - Add `opacity-60` wrapper styling
   - Replace `onToggle` with `onNavigateToFarm` so clicking navigates instead of selecting
   - Add a visible overlay badge: "Staked in [farm]" (amber text, small font) — visible without hovering
   - Keep existing tooltip and amber border for extra context
   - Add `cursor-pointer` styling

4. **In `VirtualGrid`** (line 186-193), pass a navigate callback to `FarmNFTCard`:
   - Accept `onNavigateToFarm` prop (a function taking farm name)
   - Wire it: `onNavigateToFarm={() => onNavigateToFarm?.(stakedInFarm)}`

5. **In the main component**, create navigate handler and pass it through:
   ```ts
   const navigate = useNavigate();
   const handleNavigateToFarm = (farmName: string) => navigate(`/farm/${farmName}`);
   ```

### Result
Staked-elsewhere NFTs appear dimmed with a visible "Staked in [farm]" label. Clicking navigates to that farm so the user can unstake there.

### Files changed: 1

