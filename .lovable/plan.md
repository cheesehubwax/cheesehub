## Goal

Add a fifth "cheesereserv" metric to the Drops stats bar that totals all historical CHEESE sent from `cheesenftwax` → `cheesereserv`, and keeps growing automatically via the same Hyperion history paging used by the existing "Nulled" and "xCHEESE" totals.

## Where the existing totals come from

`src/services/atomicApi.ts → fetchCheeseDropStats()` already computes the other two by paging through Hyperion action history:

- `cheeseNulled`  = sum of `cheesenftwax → eosio.null` CHEESE transfers
- `xCheeseValue` = sum of `cheesenftwax → xcheeseliqst` CHEESE transfers

The function uses `fetchCheeseTransfersHyperion({ from, to })` which already paginates the full history and is cached via `useQuery` in `src/pages/Drops.tsx`. So "add up all past trx then keep adding from now on" is automatic — every refresh re-sums the full history from Hyperion.

## Changes

### 1. `src/services/atomicApi.ts`
- Extend `CheeseDropStats` with `cheeseReserve: number`.
- Add a 5th parallel call inside `fetchCheeseDropStats`:
  `fetchCheeseTransfersHyperion({ from: 'cheesenftwax', to: 'cheesereserv' })`
- Include `cheeseReserve: Math.floor(...)` in both the success and the catch-block fallback returns.

### 2. `src/components/drops/DropStatsBar.tsx`
- Add `cheeseReserve: number` prop.
- Add a new `statItems` entry:
  - emoji: `🏦`
  - label: `cheesereserv`
  - value: `cheeseReserve.toLocaleString()`
- Adjust grid classes so 5 columns wrap cleanly on mobile. Bump `max-w-2xl` → `max-w-3xl` so 5 columns breathe on desktop.

### 3. `src/pages/Drops.tsx`
- Pass `cheeseReserve={cheeseStats?.cheeseReserve ?? 0}` to `<DropStatsBar />`.

## User preference
- Emoji: 🏦 (bank / treasury)
- Label: `cheesereserv` (exactly as requested)

## Out of scope
- No backend/contract changes.
- No new hooks or files; this is a small extension to existing data flow and the stats bar UI.