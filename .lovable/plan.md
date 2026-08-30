# Enable public CHEESERam vote-reward claim button

## Goal
The `ram.chz` contract has been redeployed so its `claimvotes` action no longer requires admin authority. Flip the frontend flag so every connected wallet sees the **Fund WAX Pool** claim button again, while keeping the existing authority-error safety net.

## Changes
1. `src/lib/cheeseRam.ts`
   - Change `PUBLIC_VOTE_CLAIM` from `false` to `true`.
   - Update the comment to reflect the redeployed state.

2. `src/components/ram/FundWaxPoolCard.tsx`
   - Remove the admin-only gate so the claim button renders for any connected wallet.
   - Keep the live countdown and cooldown behaviour.
   - Preserve the `missing authority` toast fallback in case the chain still rejects a signer.

## Verification
- Preview `/ram` with a connected non-admin wallet.
- Confirm the **Fund WAX Pool** card shows the claimable WAX amount and an active **Claim** button.
- Confirm the button becomes opaque with a countdown after a successful claim.
