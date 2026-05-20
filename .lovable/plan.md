# Fix: Finalize button missing on pending proposals

## Problem
On `testdao5`, your two past proposals show status `pending`. The Finalize / Recount buttons never appear because `ProposalCard.tsx` only renders them when the proposal is both `active` AND expired:

```tsx
{isActive && isExpired && accountName && ( ... Finalize / Recount ... )}
```

But in `src/lib/dao.ts` (line ~598), a proposal whose `end_time` has passed gets reclassified:
- `pending` — ended recently (under the expiry threshold), still finalizable on-chain
- `expired` — ended a long time ago

Once status flips away from `active`, the buttons disappear, even though the on-chain `finalize` action is exactly what's needed to move them to passed/rejected/executed.

## Fix
Update the visibility gate in `src/components/dao/ProposalCard.tsx` so Finalize/Recount also show for `pending` (and `expired`/`inconclusive`) proposals that have ended and have not yet been finalized on-chain.

Change:
```tsx
{isActive && isExpired && accountName && ( ... )}
```
to something like:
```tsx
const needsFinalize =
  accountName &&
  (
    (isActive && isExpired) ||
    proposal.status === "pending" ||
    proposal.status === "expired" ||
    proposal.status === "inconclusive"
  );

{needsFinalize && ( ... Finalize / Recount ... )}
```

No other logic changes — `handleFinalize` / `handleRecount` and the `buildFinalizeProposalAction` / `buildRecountProposalAction` builders already work; they just weren't reachable from the UI for these statuses.

## Scope
- One file: `src/components/dao/ProposalCard.tsx`
- Pure UI/presentation change, no contract or data-fetching changes.

## Verification
After the change, open `testdao5` → Past Proposals as `fragglerockk`; both pending proposals should now show "Finalize Proposal" and "Recount" buttons. Clicking Finalize signs the on-chain `finalize` action and the status will update on next refresh.
