## Root cause

In `src/lib/dao.ts` → `buildCreateDaoAction` (line 773):

```ts
proposer_type: config.proposerType || 1,
```

The "Authors Only" UI option has key `"0"`. `parseInt("0") = 0`, which is **falsy**, so `|| 1` overrides it and sends `proposer_type: 1` ("Anyone") to the contract. The `authors` array still goes through, which is why testdao4 had 2 authors recorded but displayed "Anyone".

Verified on-chain against `dao.waxdao::daos` for testdao4: `proposer_type: 1`, `authors: ["fragglerockk", "liquidcheese"]`. So this is a write bug, not a display bug — `DaoDetail.tsx` and `DaoCard.tsx` are rendering correctly.

## Fix

One-line change in `src/lib/dao.ts`:

```ts
// before
proposer_type: config.proposerType || 1,
// after — preserves 0 ("Authors Only"), still defaults when undefined
proposer_type: config.proposerType ?? 1,
```

`??` only falls back when the value is `null`/`undefined`, so `0` and `2` pass through correctly.

## Why no other fields need changing

I audited the rest of `buildCreateDaoAction` for the same `|| fallback` pattern on numeric fields:

- `threshold || 50.0`, `hoursPerProposal || 72`, `daoType || 4`, `minimumVotes || 1` — `0` is not a meaningful value for any of these, leave as-is.
- `minimumWeight || 0` — already correct.
- `proposer_type` is the only enum where `0` is a valid choice, so it's the only line that needs `??`.

## Files changed

- `src/lib/dao.ts` — single-line change on the `proposer_type` field inside `buildCreateDaoAction`.

No UI changes. Existing DAOs are not affected (the contract has no `editproposer` action), but every new DAO created with "Authors Only" selected will now be saved correctly on-chain.
