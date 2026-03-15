

## Fix: Treasury showing stale data across DAOs

**Root cause**: In `DaoDetail.tsx`, `treasuryLoaded` is a `useState(false)` that gets set to `true` after the first treasury fetch. When the user navigates from DAO A to DAO B (the `daoName` prop changes), React reuses the component instance -- so `treasuryLoaded` stays `true` and the treasury data from DAO A is never replaced.

The same issue affects `treasury` and `treasuryNFTs` state -- they keep showing the previous DAO's data.

**Fix**: Add a `useEffect` that resets treasury state when `daoName` changes.

### Changes

**`src/components/dao/DaoDetail.tsx`** -- Add a reset effect after the existing state declarations (~line 67):

```ts
// Reset treasury when switching DAOs
useEffect(() => {
  setTreasury([]);
  setTreasuryNFTs([]);
  setTreasuryLoaded(false);
}, [daoName]);
```

This ensures that when `daoName` changes, the treasury section will re-fetch the correct DAO's `tokenvault` and `nftvault` tables. The fetch functions themselves (`fetchDaoTreasury`, `fetchDaoTreasuryNFTs`) already correctly scope by `daoName` -- the bug is purely the stale flag.

