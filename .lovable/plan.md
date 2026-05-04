## Issue

On the testdao5 proposal, you voted Yes with 6 NFTs. The tally correctly shows "Yes: 6", but the per-user line reads "You voted yes (weight: 1)". The number 1 is wrong — it should be 6 (the number of NFTs used for the vote).

## Root cause

In `src/components/dao/ProposalCard.tsx`, every vote handler stores the local `UserVote.weight` as:

```ts
weight: stakedWeight?.weight || 1
```

`stakedWeight` is only fetched for token-staking DAOs (`dao.dao_type === 4`):

```ts
if (!accountName || dao.dao_type !== 4) return;
fetchUserStakedTokens(daoName, accountName).then(setStakedWeight);
```

For NFT-governance DAOs (`dao.dao_type === 5`, "Type 5"), `stakedWeight` stays null, so the recorded weight always falls back to `1`, regardless of how many NFTs were sent with the vote.

## Fix

Use the count of `selectedNFTs` as the weight when the DAO is type 5; otherwise keep the existing token-stake weight.

### Changes in `src/components/dao/ProposalCard.tsx`

1. Compute the effective weight in one place:
   ```ts
   const computeVoteWeight = () => {
     if (isType5) return selectedNFTs.length || 1;
     return stakedWeight?.weight || 1;
   };
   ```
2. Use `computeVoteWeight()` in both `handleYNAVote` and `handleMultiVote` when constructing `voteData`:
   ```ts
   const voteData: UserVote = { choice_index: ..., weight: computeVoteWeight() };
   ```
3. (Optional polish) When `isType5`, show "Weight: N NFTs" instead of the staked-token "Weight: balance" line near line 169–170, so the displayed weight matches what was used to vote.

No on-chain behavior changes — this only corrects the locally-stored/displayed weight for NFT DAOs.

## Verification

After the fix, voting with 6 NFTs in testdao5 should display:
- Tally: "Yes: 6" (unchanged)
- Per-user line: "You voted yes (weight: 6)"
