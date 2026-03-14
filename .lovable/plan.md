

## Fix "Staked Only" Filter on Browse Farms

### Problem
The "Staked only" checkbox filters farms where `f.staked_count > 0` — i.e., farms with *any* staker. It should filter for farms where the *logged-in user* has staked NFTs.

### Solution
Use `fetchUserGlobalStakes(account)` to get the list of farm names where the current user has staked NFTs, then filter against that set.

### Changes — `src/components/farm/BrowseFarms.tsx`

1. Import `fetchUserGlobalStakes` from `@/lib/farm`
2. Add a second `useQuery` that fetches the user's global stakes when `accountName` is available:
   ```ts
   const { data: userStakes = [] } = useQuery({
     queryKey: ["userGlobalStakes", accountName],
     queryFn: () => fetchUserGlobalStakes(accountName!),
     enabled: !!accountName && stakedOnly,
     staleTime: 30_000,
   });
   ```
3. Build a `Set<string>` of farm names from `userStakes` and replace the filter logic:
   ```ts
   if (stakedOnly && accountName) {
     const stakedFarmNames = new Set(userStakes.map(s => s.farmName));
     result = result.filter(f => stakedFarmNames.has(f.farm_name));
   }
   ```

This ensures "Staked only" shows only farms where the connected wallet actually has NFTs staked.

