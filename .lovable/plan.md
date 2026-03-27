

## Fix: CHEESE Collected stat on CheeseDrop page

### Current Implementation
- **CHEESE Collected**: Sums outgoing CHEESE transfers from `nfthivedrops` (revenue collected)
- **CHEESE Nulled**: Sums CHEESE transfers from `cheesenftwax` to `eosio.null` (80% burn)
- **xCHEESE Value**: Sums CHEESE transfers from `cheesenftwax` to `xcheeseliqst` (20% staking)
- All stats track from March 24, 2026 onward via Hyperion history

### Files changed: 1
- `src/services/atomicApi.ts`

