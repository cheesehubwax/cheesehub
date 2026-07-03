### Add "Staked" balance to CHEESEWallet header bar

In `src/components/wallet/WalletResources.tsx`, the top `flex items-center justify-between` header bar currently shows:
- **Left**: Account name + Liquid WAX balance
- **Right**: Total WAX Balance

### Changes

**`src/components/wallet/WalletResources.tsx`**

1. Compute `stakedBalance = selfCpuStaked + selfNetStaked` (already available in component).
2. Restructure the header flex row from 2 sections to 3:
   - Left: Account + Liquid balance (unchanged)
   - **Center (new)**: "Staked" label + `stakedBalance.toFixed(4) WAX` value
   - Right: Total WAX Balance (unchanged)
3. Use `flex-1` or `justify-around` / grid to evenly distribute the 3 sections so the center fills the gap.

**No other files touched.** The staked total already sums both CPU and NET self-staked weight. Liquid + Staked will equal the existing Total WAX Balance by definition.

**Out of scope**: No new hooks, no data fetching changes, no logic changes — purely a layout addition using already-computed values.