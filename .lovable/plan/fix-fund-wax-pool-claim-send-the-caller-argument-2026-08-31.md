# Fix Fund WAX Pool claim — send the `caller` argument

## Root cause

The redeployed `ram.chz` contract changed `claimvotes` to take a required `caller` argument of type `name` (the account authorizing the claim). The Fund WAX Pool card still sends empty action data (`data: {}`), so WharfKit fails before broadcasting with:

`Encoding error at root<claimvotes>.caller<name>: Found undefined for non-optional type: name`

This matches the public-claim contract design agreed earlier: the caller authorizes the action, while the inner `eosio::claimgbmvote` is still sent with the contract's own authority.

## Fix

One edit in `src/components/ram/FundWaxPoolCard.tsx`:

- In `handleClaim`, change the action data from `data: {}` to `data: { caller: session.permissionLevel.actor.toString() }` so the connected wallet account is passed as `caller`, matching the contract's new ABI.

No other changes — cooldown, zero-amount disabling, success dialog with TX ID, staggered refresh, and the `missing authority` toast mapping all stay as they are.

## Verification

- Build passes.
- On the preview, attempt a claim with a connected wallet and confirm the transaction reaches the wallet signing prompt instead of failing locally with the encoding error.
