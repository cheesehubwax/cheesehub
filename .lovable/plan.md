

## Fix Farm Deposit UI + Audit Farm/DAO Action Correctness

### Issues Found

**1. Deposit Dialog only renders for creators (bug)**
The "Deposit Rewards" button is visible to all connected users (line 262), but the `DepositRewardsDialog` component is rendered inside `{isCreator && ...}` (line 459-471). Non-creators click the button and nothing happens.

**2. Wrong deposit memo**
Our `buildAddRewardsAction` in `src/lib/farm.ts` uses memo `|deposit|${farmName}|`. The GitHub reference uses `|farm_deposit|${farm.farm_name}|`. This memo mismatch means deposits may silently fail or be rejected by the contract.

**3. Layout doesn't match screenshot**
The screenshot shows Farm Information and Reward Pools side by side in a 2-column grid. Our current layout stacks them vertically. The Reward Pools card also shows a `+ Deposit` button in the card header and displays full token balances (e.g., "0.00000000 WAX") with a badge-style display.

**4. Farm Stats section positioning**
Screenshot shows Farm Stats below the info/pools grid row with a dedicated Refresh button. Our stats cards are currently above the info card.

### Changes

**File 1: `src/lib/farm.ts`**
- Fix `buildAddRewardsAction` memo from `|deposit|${farmName}|` to `|farm_deposit|${farmName}|`

**File 2: `src/components/farm/FarmDetail.tsx`**
- Move `DepositRewardsDialog` outside the `{isCreator && ...}` block so all connected users can use it
- Restructure layout to match screenshot:
  - Farm Information + Reward Pools in a 2-column grid (`grid-cols-1 md:grid-cols-2`)
  - Reward Pools card shows `+ Deposit` button in header (for any connected user)
  - Reward pools display full balance amounts with badge styling (e.g., "0.00000000 WAX" in a colored badge)
  - Move Stats cards below the info/pools row, add "Farm Stats" header with Refresh button
  - Move Stakeable Assets section below stats
- Keep Withdraw button creator-only in the Reward Pools card header

**File 3: `src/components/farm/DepositRewardsDialog.tsx`**
- No structural changes needed; it already accepts farm prop and works independently of creator status

### Audit Results — No Other Issues Found

- **CreateFarm.tsx**: Fee flow is correct (CHEESE/WAX → assertpoint → WAXDAO fee → createfarm)
- **CreateDao.tsx**: Fee flow is correct (CHEESE/WAX → assertpoint → WAXDAO fee → createdao → setprofile)
- **WithdrawRewardsDialog**: Uses `farms.waxdao::withdraw` action — matches contract ABI
- **NFTStaking stake/unstake**: Memos and action names match contract (`stakenfts`, `unstake`)

### Files changed: 2
- `src/lib/farm.ts` (memo fix)
- `src/components/farm/FarmDetail.tsx` (layout + deposit dialog accessibility)

