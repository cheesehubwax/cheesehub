# ARCHIVED — DO NOT IMPLEMENT

**Status:** Dropped (April 2026)

**Reason:** The `tf.waxdao` contract is **custodial** — user tokens are pooled
and held by the contract during staking. Adding a frontend for a custodial,
pooled, passive-return product creates material legal exposure under
Australian law (likely qualifies as an unregistered Managed Investment
Scheme per ASIC INFO 225) and inherits third-party contract risk that
CheeseHub cannot audit, patch, or insure against. CHEESEFarm will remain
**NFT-only / non-custodial** (`farms.waxdao`).

Do not re-open this plan without re-evaluating the legal position. If the
contract is ever migrated to a non-custodial design, a fresh plan should
be written from scratch.

---

## Add V2 Token Staking Farms (tf.waxdao) to CHEESEFarm

A new tab inside CHEESEFarm for browsing and interacting with WaxDAO V2 **token** staking farms. NFT farms (`farms.waxdao`) stay untouched. Farm **creation** is deferred to a later phase — Phase 1 covers viewing, staking, unstaking, claiming, and withdrawing rewards.

---

### Phase 1 — Browse & interact (this plan)

#### New tab in CHEESEFarm
`src/pages/Farm.tsx` gets a new `Tabs` group at the top to switch between **NFT Farms** (existing 3 tabs) and **Token Farms** (new). Existing NFT tabs and routing (`/farm/:farmName`) stay as-is. Token farm detail uses a new route `/farm/token/:farmName` so the two systems don't collide.

The Token Farms tab has its own internal sub-tabs:
- **Browse Farms** — all token farms
- **My Stakes** — farms where the connected wallet has a non-zero balance or claimable rewards

(Create Farm sub-tab is added in Phase 2.)

#### New library: `src/lib/tokenFarm.ts`
Mirrors the structure of `src/lib/farm.ts` but for `tf.waxdao`. Contents:

- **Constants**: `TOKEN_FARM_CONTRACT = "tf.waxdao"`
- **Types** based on the actual ABI:
  - `TokenFarmInfo` — `{ farm_name, creator, time_created, staking_token: { sym, contract }, incentive_count, total_staked (uint64 raw), vesting_time, last_update_time }`
  - `TokenFarmReward` — `{ id, period_start, period_finish, reward_rate (uint128 string), rewards_duration, reward_per_token_stored (uint128 string), reward_pool: { quantity, contract }, total_rewards_paid_out }`
  - `TokenFarmStakerRow` — `{ farm_name, balance, last_update, claimable_balances: [{quantity, contract}], paid: [{first, second}], vesting_end_time }`
  - Derived: `EnrichedTokenFarm` = farm + parsed staking token symbol/precision + rewards array + computed APR per reward token.
- **Fetchers** (using existing `fetchTableRows` from `waxRpcFallback`):
  - `fetchAllTokenFarms()` — paginates `tf.waxdao` / scope `tf.waxdao` / table `farms`
  - `fetchTokenFarmRewards(farmName)` — scope = `farmName`, table `rewards`
  - `fetchUserTokenStakes(account)` — scope = account name, table `stakers` (returns rows for every farm the user has interacted with)
  - `fetchUserTokenStakeForFarm(account, farmName)` — same table, lower/upper bound on farm name
- **Helpers**:
  - `parseExtendedSymbol(sym)` → `{ precision, symbol }`
  - `formatStakedAmount(raw, precision)` → human string (raw `total_staked` is already in token base units)
  - `computeRewardRatePerSecond(reward_rate)` → divide uint128 by 1e18 scaling factor (waxdao standard) to get tokens/sec; verify scale by sampling a live farm
  - `computeFarmApr(reward, totalStakedRaw, stakingPrecision, rewardPrecision)` — annualized rate using reward_rate, only meaningful when `now < period_finish`
  - `computeClaimableNow(staker, farm, rewards)` — sum `claimable_balances` plus accrual since `staker.last_update` using `(reward_per_token_stored - paid[id]) * staker.balance / 1e18` per reward
  - `isVesting(staker)` and `vestingTimeRemaining(staker)` for unstake gating
- **Action builders** matching ABI:
  - `buildStakeTransfer(user, farm, contract, quantity)` → `eosio.token`-style transfer to `tf.waxdao` with memo `|stake|<farm_name>|` (memo format must be confirmed; default WaxDAO V2 pattern)
  - `buildUnstakeAction(user, farm, amount)` → `tf.waxdao::unstake { user, farm_name, amount }`
  - `buildClaimAction(user, farm)` → `tf.waxdao::getreward { user, farm_name }`
  - `buildWithdrawAction(user, farm)` → `tf.waxdao::withdraw { farm_name }` (claims released vested balance after `vesting_end_time`)

> Memo formats and exact transfer flow for staking will be confirmed by inspecting recent successful `tf.waxdao` stake transactions on `waxblock.io` during implementation. If the format differs, the builder is the only place to update.

#### New components under `src/components/farm/token/`

- `TokenFarmBrowse.tsx` — search + filter (active only, my-stakes only, sort by TVL/newest/name) + responsive grid of cards. Mirrors `BrowseFarms.tsx`.
- `TokenFarmCard.tsx` — shows staking token logo, total staked, # active reward incentives, vesting period, "Active/Ended" badge. Click → `/farm/token/:farmName`. Mirrors `FarmCard.tsx`.
- `TokenFarmDetail.tsx` — full view:
  - Header: farm name, creator, staking token, vesting period, total staked
  - **Reward Incentives panel**: list of all rewards with token logo, remaining pool, rate (tokens/day), end date, status badge (active / ended / scheduled)
  - **My Position panel** (when wallet connected): staked balance, claimable rewards per token, vesting status, action buttons:
    - Stake → opens `StakeTokenDialog`
    - Unstake → opens `UnstakeTokenDialog` (with vesting countdown if applicable)
    - Claim Rewards → calls `getreward` directly
    - Withdraw Vested → calls `withdraw` (only enabled after `vesting_end_time`)
- `StakeTokenDialog.tsx` — token amount input pre-loaded with user's wallet balance for the staking token (reuses `useTokenBalance`), MAX button, fires `eosio.token`-style transfer.
- `UnstakeTokenDialog.tsx` — amount input capped at staked balance, MAX button, shows vesting warning (funds locked for `vesting_time` after unstake), fires `unstake`.
- `MyTokenStakes.tsx` — list of farms where the user has a `stakers` row with balance > 0 OR claimable > 0, with quick "Claim All" per farm.

#### React Query hooks
Add three keyed queries reused across components:
- `["tokenFarms"]` → `fetchAllTokenFarms`, 60s stale
- `["tokenFarmRewards", farmName]` → `fetchTokenFarmRewards`, 30s stale
- `["userTokenStakes", account]` → `fetchUserTokenStakes`, 30s stale, enabled when connected

All mutations (stake/unstake/claim/withdraw) invalidate the relevant keys plus the user's WAX-side token balance.

#### Routing
`src/App.tsx` gets one new route: `/farm/token/:farmName` → renders `Farm.tsx` which detects the `token` segment and shows `TokenFarmDetail` instead of NFT `FarmDetail`. Alternative: a separate page component — either works; we'll use the detect-in-Farm.tsx approach to keep the hero/header consistent.

#### Visual style
Follows `mem://style/layout-standardization` and `mem://style/visual-theme`: same hero block, same `TabsList` styling, same card pattern (`bg-card/80 border-primary/30`), `TokenLogo` for token symbols, badges in the established color scheme.

---

### Phase 2 (deferred) — Farm creation
Will add `CreateTokenFarm.tsx` + `AddRewardDialog.tsx` + `ExtendRewardDialog.tsx` + admin actions, fee-handling via existing `FeePaymentSelector`, and management actions for farm owners. Plan for that lands after Phase 1 ships.

---

### Files added / changed (Phase 1)

**New**
- `src/lib/tokenFarm.ts`
- `src/components/farm/token/TokenFarmBrowse.tsx`
- `src/components/farm/token/TokenFarmCard.tsx`
- `src/components/farm/token/TokenFarmDetail.tsx`
- `src/components/farm/token/MyTokenStakes.tsx`
- `src/components/farm/token/StakeTokenDialog.tsx`
- `src/components/farm/token/UnstakeTokenDialog.tsx`

**Modified**
- `src/pages/Farm.tsx` — add outer NFT/Token tab switcher; render token components; detect `/farm/token/:farmName`
- `src/App.tsx` — add `/farm/token/:farmName` route

---

### Open items to verify during implementation

1. **Stake transfer memo format** — confirm by reading 2–3 recent stake txs on `waxblock.io` for `tf.waxdao`. Likely `|stake|<farm_name>|` based on WaxDAO V2 conventions.
2. **`reward_rate` scaling** — uint128 string is scaled (typical: 1e18). Will validate against a live farm by computing daily emission and comparing to `reward_pool.quantity / rewards_duration`.
3. **`total_staked` units** — appears to be raw base units (no decimal). Confirm with a known farm.
4. **Vesting semantics** — confirm whether `vesting_time` applies on unstake (funds locked) or on stake; behavior of `withdraw` action will be verified against contract source on waxblock.

These are small checks done while wiring, not blockers for the plan.
