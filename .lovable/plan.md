

## Add "Liquidity Fees" to Null Breakdown Table

### What changes
Track CHEESE sent by `liquidcheese` to `eosio.null` and display it as "Liquidity Fees" in the null breakdown popover on the front page.

### Technical details

**1. `src/lib/cheeseNullBreakdown.ts`**
- Add `displayName` field to `NullBreakdownEntry` interface
- Change `NULL_CONTRACTS` from a simple string array to an array of objects with `account` and `displayName`
- Add entry: `{ account: 'liquidcheese', displayName: 'Liquidity Fees' }`
- Existing contracts get display names matching their account names (cheeseburner, cheesefeefee, cheesepowerz, cheesebannad)
- Update `fetchNullBreakdown` to map through the new structure and populate `displayName` on each result

**2. `src/components/home/TokenStatsBanner.tsx`**
- Change the table cell on line 228 from `{entry.contract}` to `{entry.displayName ?? entry.contract}` so the new entry shows "Liquidity Fees" instead of "liquidcheese"

### Files to modify
- `src/lib/cheeseNullBreakdown.ts`
- `src/components/home/TokenStatsBanner.tsx`

