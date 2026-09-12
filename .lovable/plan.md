# CHEESEAnal account detail — reset pool filter on account change and add a "Show all" control

## Goal
In CHEESEAnal's account detail panel, switching accounts should always start from the full account overview. Also make it easy to return to the full overview after drilling into a single pool.

## Changes

1. Reset pool selection automatically when the account changes.
   - In `src/components/anal/AnalAccountPanel.tsx`, add a `useEffect` that sets `selectedPool` back to `null` whenever the `account` prop changes.
   - Keep the existing `selectAccount` helper so manual lookups/clears also reset the pool.

2. Add a clear "Show all pools" button.
   - When `selectedPool` is active, show a small `Button` at the top of the holdings table (next to the "Click a pool to filter..." hint) that clears the pool filter.
   - Keep the existing row-click toggle and the inline "All pools ×" chip so the UX stays consistent.

3. Verify with a browser check.
   - Use Playwright to: select an account, click a pool row to filter, switch account via the provider list, and confirm the charts return to "All pools".
   - Confirm the new "Show all pools" button also returns to the total overview.

## Files touched
- `src/components/anal/AnalAccountPanel.tsx`
