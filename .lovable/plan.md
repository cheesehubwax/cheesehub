## Plan: Token-selectable proposal submission fee

### Issue confirmed
The `dao.waxdao` contract stores `proposal_cost` as an `asset` (any token), and `createdao` / `editpropcost` both accept any token symbol. Our frontend currently hardcodes WAX everywhere:

- `CreateDao.tsx` — input is labeled "Proposal Submission Fee (WAX)" and `buildCreateDaoAction` formats it as `${cost} WAX` with 8-decimal precision.
- `EditProposalCost.tsx` — same WAX-only input.
- `CreateProposal.tsx` — pays the cost via `buildProposalCostAction`, which is hardcoded to `account: "eosio.token"`. Any DAO created with a non-WAX cost would fail to pay.

(Side note: live on-chain data shows every existing DAO currently uses WAX for `proposal_cost`, so this is purely an expanded option, not a regression.)

### Changes

**1. `src/lib/dao.ts`**
- Replace `buildProposalCostAction(sender, proposalCost)` with `buildProposalCostAction(sender, proposalCost, tokenContract)` so the transfer's `account` matches the token's contract (e.g. `cheese4token` for CHEESE).
- Extend `buildCreateDaoAction`'s config: add `proposalCostSymbol?: string`, `proposalCostPrecision?: number` (default 8 / WAX). Format the asset string accordingly: `amount.toFixed(precision) + " " + symbol`.

**2. `src/components/dao/CreateDao.tsx`**
- Replace the WAX-only number input with a small composite control:
  - Token selector (Select) — options: WAX, CHEESE, WAXDAO (reuse the `WAX_TOKENS` list pattern already in `CreateProposal.tsx`; lift it to `src/lib/dao.ts` as `PROPOSAL_FEE_TOKENS`).
  - Amount input (number).
- Pass `proposalCostSymbol`, `proposalCostPrecision`, `proposalCost` into `buildCreateDaoAction`.
- Update label from "Proposal Submission Fee (WAX)" → "Proposal Submission Fee" with helper "Choose any supported token. Set to 0 for free proposals."

**3. `src/components/dao/EditProposalCost.tsx`**
- Add the same token selector. Build the asset string with the chosen token's precision and symbol.
- (Existing `editpropcost` action already takes a generic asset string — no `dao.ts` change needed beyond formatting.)

**4. `src/components/dao/CreateProposal.tsx`**
- When paying the cost, parse `dao.proposal_cost` to extract the symbol, look up the matching contract from `PROPOSAL_FEE_TOKENS`, and pass it to `buildProposalCostAction`. Fall back to `eosio.token` for WAX.
- If the symbol is unknown (custom token), show a clear inline message instead of submitting a guaranteed-failing transfer.

### Out of scope
- Allowing arbitrary custom token contracts beyond the supported list. Can be added later if needed; the contract permits it but it requires extra validation.

### Files touched
- `src/lib/dao.ts`
- `src/components/dao/CreateDao.tsx`
- `src/components/dao/EditProposalCost.tsx`
- `src/components/dao/CreateProposal.tsx`