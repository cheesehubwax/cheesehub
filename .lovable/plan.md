

## Add "Stake All Positions" Button to Alcor Farm Manager Header

### Summary
Add a green "Stake All Positions" button at the top of the Alcor Farm Manager (next to the existing "Claim & Unstake Ended" button) that appears when there are unstaked LP positions with available farm incentives. This button will stake all unstaked positions into all their available incentives in a single transaction.

### Changes

**`src/components/wallet/AlcorFarmManager.tsx`**

1. **Add a `handleStakeAllUnstakedPositions` callback** that collects all unstaked positions and their available incentives, builds stake actions for each, and executes them in a single transaction batch.

2. **Add green button in the header bar** (lines ~415-425, alongside the expired button and unstaked badge):
   - Appears only when `unstakedList.length > 0`
   - Green styling (`bg-green-600 hover:bg-green-700`) matching the per-card stake buttons
   - Shows count: `Stake All Positions (N)`
   - Uses `Zap` icon like existing stake buttons
   - Replace the current red pulsing badge with this actionable button

### Files changed: 1

