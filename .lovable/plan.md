

## Plan: Fix token balance fetching to stop unnecessary RPC fallback

### Problem
The Hyperion API returns all balances in a single fast call, but a 5-minute staleness threshold causes the system to distrust it and fire 28 individual RPC calls instead. Hyperion indexers commonly lag a few minutes -- this doesn't mean the data is wrong.

### Solution

**1. `src/lib/waxRpcFallback.ts`**
- Increase `STALE_THRESHOLD_MS` from 5 minutes to 60 minutes. A 5-minute lag on Hyperion is normal and the balances are still accurate. Only truly stale data (1hr+) should trigger fallback.

**2. `src/hooks/useAllTokenBalances.ts`**
- When Hyperion IS stale and RPC fallback runs, only query tokens the user likely holds (from Hyperion's stale response) instead of all 28 registry tokens. This avoids dozens of failed RPC calls for contracts that don't exist.
- Additionally, when Hyperion succeeds (even stale), use its token list as the discovery source rather than the full registry.

**3. `src/components/wallet/WalletTransferDialog.tsx`**
- Soften the fallback warning message: instead of "Using backup data source. Some tokens may not appear." show something like "Balance data may be slightly delayed" when Hyperion was stale but data was still returned.

### Why this works
WaxBlocks and similar tools use Hyperion (or equivalent indexer APIs) as their primary source. They don't fire individual RPC calls per token. By trusting Hyperion's data even when it's a few minutes behind, we get instant results in one API call with no failed requests.

### Technical detail
- `STALE_THRESHOLD_MS`: 5 min → 60 min
- RPC fallback scope: 28 registry tokens → only tokens from Hyperion's (stale) response + critical tokens (WAX, CHEESE)
- Files changed: 3

