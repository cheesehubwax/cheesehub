# Restore Original Terms Checkbox Placement

## Goal
Keep the updated wording ("I have read and agree to the Terms of Use", with "Terms of Use" as a link) but remove the terms checkbox from every transaction surface where it was newly added — restoring the original gate locations exactly as they were before the mass-add commit.

## Keep the checkbox (original locations — wording updated where needed)
- `src/components/bannerads/BulkRentDialog.tsx`
- `src/components/bannerads/RentSlotDialog.tsx`
- `src/components/dao/CreateDao.tsx`
- `src/components/dao/TreasuryDeposit.tsx`
- `src/components/drip/CreateDrip.tsx`
- `src/components/drops/CartDrawer.tsx`
- `src/components/farm/CreateFarm.tsx`
- `src/components/farm/DepositRewardsDialog.tsx`
- `src/components/locker/CreateLiquidityLock.tsx`
- `src/components/locker/CreateLock.tsx`
- `src/components/ram/BuyRamCard.tsx`
- `src/components/ram/SellRamCard.tsx`
- `src/components/wallet/WojakUnboxManager.tsx`

## Remove the checkbox (added in error — revert to no gate)
- admin/AddBannerSlotsCard.tsx
- bannerads/EditBannerDialog.tsx, RemoveBannerDialog.tsx, ReinstateBannerDialog.tsx, BulkEditBannerDialog.tsx
- cheesenull/NullButton.tsx
- dao/ClaimVoteRam.tsx, CreateProposal.tsx, DaoStaking.tsx, EditDaoProfile.tsx, EditProposalCost.tsx, ProposalCard.tsx, TreasuryNFTDeposit.tsx
- drip/MyDrips.tsx
- drops/CreateDrop.tsx, DeleteDropDialog.tsx, ManageRamDialog.tsx
- farm/CloseFarmDialog.tsx, EditFarmProfile.tsx, EmptyFarmDialog.tsx, ExtendFarmDialog.tsx, KickUsersDialog.tsx, ManageStakableAssets.tsx, NFTStaking.tsx, OpenFarmDialog.tsx, PermCloseFarmDialog.tsx, WithdrawRewardsDialog.tsx
- locker/MyLocks.tsx, MyLiquidityLocks.tsx
- powerup/PowerUpCard.tsx
- swap/CheeseSwapWidget.tsx
- wallet/AlcorFarmManager.tsx, CreateAccountManager.tsx, CreateAlcorFarmDialog.tsx, IncreaseLiquidityDialog.tsx, RamManager.tsx, RentResourcesManager.tsx, StakeManager.tsx, VoteManager.tsx, VoteRewardsManager.tsx, WalletResources.tsx

## How
1. In each "remove" file: delete the TermsCheckbox usage, its import, its `termsAccepted` state (if only used for the gate), and any `disabled={!termsAccepted ...}` conditions — restoring the button's previous enabled/disabled logic exactly.
2. In the "keep" files: ensure the wording matches "I have read and agree to the Terms of Use" with the link opening the Terms dialog (swap to the shared `TermsCheckbox` component if still on the old markup).
3. Verify the build is clean and spot-check that e.g. EditFarmProfile ("update my farm info") no longer requires the checkbox.

## Technical details
- The shared `src/components/shared/TermsCheckbox.tsx` stays — it's the single source of the wording/link.
- No logic changes beyond gate removal; no styling changes.
