# Revert Proposal Fee to WAX-Only

The `dao.waxdao` contract hard-codes WAX as the only valid `proposal_cost` token for both `createdao` and `editpropcost`. Custom tokens (CHEESE, etc.) remain supported for governance, but the proposal submission fee must be WAX.

## Changes

### 1. `src/components/dao/ProposalFeeInput.tsx`
- Remove token selector; render a WAX-only numeric input.
- Add a small caption: "Proposal fees are denominated in WAX (contract requirement)."
- Drop any localStorage persistence of custom fee tokens.

### 2. `src/components/dao/CreateDao.tsx`
- Remove the batched `editpropcost` action appended after `createdao`.
- Always pass `WAX` (precision 8) as `proposalCostSymbol` / `proposalCostPrecision`.
- Remove any `feeToken.symbol !== "WAX"` branching and related state.

### 3. `src/components/dao/EditProposalCost.tsx`
- Lock the edit form to WAX only (remove token picker if present).
- Keep the action wired to `buildEditPropCostAction` with WAX formatting.

### 4. `src/lib/dao.ts`
- Keep `buildEditPropCostAction` and `buildCreateDaoAction` helpers intact.
- No signature changes required; callers will simply always pass WAX.
- Remove any now-unused custom-token fee helpers/constants if present.

### 5. UI copy
- In CreateDao and EditProposalCost, add a one-line note clarifying that governance token (voting) can still be CHEESE / NFTs / other tokens — only the per-proposal submission fee is WAX.

## Out of scope
- Governance token selection (CHEESE / custom / NFT) remains unchanged.
- Treasury, voting, and DAO type logic untouched.

## Verification
- Create a non-custodial NFT DAO with CHEESE governance token and 1 WAX proposal fee → transaction should sign and broadcast without the "Proposal cost must be in WAX" assertion.
