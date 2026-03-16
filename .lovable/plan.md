

## Fix Farm Owner Actions — Match CheesHub Exactly

### Problem
Our FarmDetail has incorrect status code mappings and action visibility logic compared to the cheesehub source. The cheesehub contract uses:
- **Status 0** = Under Construction (also the state after `closefarm`)
- **Status 1** = Active
- **Status 2** = Permanently Closed

Our code incorrectly uses status 2 = "Closed" and status 3 = "Permanently Closed". Additionally, action button visibility conditions don't match the source, and we're missing the **WithdrawRewardsDialog** and contextual info boxes.

### Changes

#### 1. Fix status codes in `FarmDetail.tsx` (`getStatusInfo` and button logic)

Replace the current status logic with cheesehub's correct mapping:
```
isUnderConstruction = farm.status === 0
isPermClosed = farm.status === 2
isExpired = !isUnderConstruction && !isPermClosed && farm.expiration < now
hasStakers = farm.staked_count > 0
```

#### 2. Fix action button visibility (matching cheesehub exactly)

Current buttons and their **correct** visibility conditions from cheesehub:

| Action | When visible |
|---|---|
| **Edit Profile** | `isCreator` (always) |
| **Deposit Rewards** | `isCreator` (always) |
| **Manage Stakable Assets** | `isCreator && isUnderConstruction` (only when under construction) |
| **Open Farm** | `isCreator && isUnderConstruction` (in header area) |
| **Extend Farm** | `isCreator && !isUnderConstruction && !isExpired && !isPermClosed` (active, not expired) |
| **Withdraw Rewards** | `isCreator && !isUnderConstruction && !isExpired && !isPermClosed` (active, not expired) |
| **Close Farm** | `isCreator && isExpired && !isPermClosed` (only when expired) |
| **Perm Close** | `isCreator && isExpired && !isPermClosed` (only when expired, shown alongside Close) |
| **Kick Stakers** | `isCreator && (isUnderConstruction \|\| isPermClosed) && hasStakers` |
| **Empty Farm** | `isCreator && isPermClosed && !hasStakers` |

#### 3. Add contextual info boxes for creators

Cheesehub shows different guidance messages depending on state:
- **Perm Closed**: "Kick all users, then use Empty Farm to retrieve leftover tokens..."
- **Under Construction + has stakers** (post-close): "Now kick all users, update stakeable assets..."
- **Under Construction + no stakers** (fresh): "Add stakeable assets, deposit reward tokens, then Open Farm..."
- **Expired**: "You have 2 choices: 1) Close farm, kick users, reopen. 2) Perm close, kick, empty."
- **Active (not expired)**: "Extend your farm by pressing Extend..."

#### 4. Create `WithdrawRewardsDialog` component

New dialog that lets the creator withdraw excess rewards from active farms. Shows each reward pool with an amount input. Calls `farms.waxdao::withdraw` action with `{ user, farm_name, amount: { quantity, contract } }`.

#### 5. Place action buttons in correct locations

In cheesehub, buttons are spread across the UI contextually (not all lumped together):
- **Edit Profile** and **Deposit Rewards** in the header section
- **Manage Stakable Assets** in header (only under construction)
- **Extend** next to the expiration date field
- **Close/Perm Close** next to expiration when expired
- **Kick Stakers** and **Empty Farm** in the Farm Information section
- **Withdraw** next to Reward Pools header

### Files to modify
- `src/components/farm/FarmDetail.tsx` — Fix status codes, action visibility, info boxes, button placement
- `src/components/farm/WithdrawRewardsDialog.tsx` — New file
- `src/lib/farm.ts` — Add `buildWithdrawRewardsAction` if not present

