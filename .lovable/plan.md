# Public "Sponsor Farm Rewards" Flow

## Background

The `farms.waxdao` V2 contract accepts reward deposits from **any WAX account** via a `transfer` with memo `|farm_deposit|<farmname>|`. There is no creator-only check on-chain.

In the current UI, the **+ Deposit** button on `FarmDetail` already shows for any connected wallet (gated only by `isConnected`), but:
- The dialog copy reads "your farm's pools" — implying creator-only and confusing for sponsors.
- There's no Terms of Use checkbox, despite this being a sensitive on-chain transfer (project rule requires it for Deposits).
- Expired/empty farms — which can block unstakes — give users no hint that a top-up could unblock them.

## What changes

### 1. Reframe the deposit dialog as a public sponsor flow

File: `src/components/farm/DepositRewardsDialog.tsx`

- Rename dialog title to **"Deposit Rewards to Farm"** and show the farm name + creator below it.
- Rewrite the description to make it explicit:
  > "Anyone can sponsor this farm by depositing reward tokens. Deposited tokens are sent directly to the `farms.waxdao` contract and distributed to stakers — they cannot be withdrawn except by the farm creator."
- Add a small warning row when the depositor is **not** the farm creator:
  > "You are not the creator of this farm. Deposits are non-refundable and will be distributed to stakers."
- Add the standard **Terms of Use checkbox** (mirror the pattern in CreateLock / CreateFarm using `TermsContent` + `TermsDialog`), and disable the Deposit button until checked.

### 2. Make the public "Deposit" entry point obvious on FarmDetail

File: `src/components/farm/FarmDetail.tsx`

- Keep the existing **+ Deposit** button in the Reward Pools header (already public).
- Relabel it to **"Sponsor Rewards"** for non-creators, keep **"+ Deposit"** for the creator, so the action reads naturally in both contexts.
- Disable the button (with tooltip) when farm `status === 2` (Permanently Closed) or `status === 0` (Under Construction) — depositing into those states is wasteful.

### 3. Surface the top-up workaround on expired farms

File: `src/components/farm/FarmDetail.tsx` (extend the existing `CreatorInfoBox` / status info card to show for everyone, not just creator)

When the farm is **Expired** AND the user has NFTs staked (or any reward pool balance is zero), show a one-line info card visible to any viewer:

> "This farm is expired. If unstaking fails with a contract assertion, the reward pool may be empty. Anyone can deposit a small amount of the listed reward token to unblock claims and unstakes."

with a quick **"Sponsor Rewards"** button that opens the same deposit dialog.

### 4. Disclaimer note (small)

File: `src/pages/Disclaimer.tsx`

Add one sentence under §5 / Financial Services:
> "Reward token deposits to third-party `farms.waxdao` contracts are permissionless and non-refundable to the depositor; CHEESEHub does not custody or control deposited rewards."

## Out of scope

- No changes to the on-chain action itself (`buildAddRewardsAction` stays as-is — it's already correct).
- No changes to the unstake flow itself; that diagnosis remains a contract-side issue and the sponsor flow is the user-actionable workaround.
- No new routes or pages.

## Technical details

- Reuse `TermsContent` + `TermsDialog` from `src/components/shared/` — same pattern as `CreateFarm.tsx` and `CreateLock.tsx`.
- The "is creator?" check is already computed in `FarmDetail` as `const isCreator = accountName === farm.creator;` — pass that down to `DepositRewardsDialog` as a prop to drive the warning row.
- Expired check: reuse `farm.expiration > 0 && farm.expiration < now` (already in `getStatusInfo`).
- No new hooks, no new contract actions, no API changes.

## Files touched

- `src/components/farm/DepositRewardsDialog.tsx` — copy, sponsor warning, Terms gate, new `isCreator` prop.
- `src/components/farm/FarmDetail.tsx` — button label switch, disable on bad statuses, expired-farm sponsor info card.
- `src/pages/Disclaimer.tsx` — one-sentence clarification.
