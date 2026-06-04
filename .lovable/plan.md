## Goal

Fix the discrepancy between the bottom "Total CHEESE Nulled" stat (1006, from the contract's own `stats` table) and the "Null Breakdown by Contract" popover (845 for `cheeseburner`, from a Hyperion history scan). The on-chain `stats` row is authoritative; Hyperion scans miss actions when endpoints lag, drop history, or cap out at 50,000 actions.

## Approach

For each contract that publishes its own on-chain counter, read the all-time `amount` from that counter instead of summing Hyperion transfers. Keep Hyperion only for the 24h / 7d / 30d windowed values (since the on-chain counter has no time dimension).

## Changes

### `src/lib/cheeseNullBreakdown.ts`

- Add a per-contract resolver for the authoritative all-time amount:
  - `cheeseburner` → read `cheeseburner::cheeseburner::stats::total_cheese_burned` (same source the bottom stats bar uses, via `fetchContractStats` in `cheeseNullApi.ts`).
  - `cheesepowerz` → already uses on-chain `cpower stats::total_cheese_received`; keep as-is.
  - `cheesefeefee`, `cheesebannad`, `cheesenftwax`, `liquidcheese` → if a stats row exists with a cumulative-nulled field, use it; otherwise fall back to the existing Hyperion sum. (I'll inspect each contract's tables before wiring; any without an authoritative counter stay on Hyperion.)
- Refactor `fetchContractNulled(account)` to:
  1. Try the on-chain authoritative source for that account.
  2. Fall back to `fetchContractNulledFromHyperion(account)` if the on-chain read fails or returns null.
- Leave `fetchContractNulledFromHyperion(account, after)` unchanged and keep using it for the `amount24h`, `amount7d`, `amount30d` values — those require time-windowed history that the on-chain counter cannot provide.
- The `grandTotal` (used for percent shares) will naturally come out using the authoritative numbers, so percentages will align with the bottom stat bar.

### No UI changes

`NullBreakdown` popover, `NullTotalStats` bar, and the hooks (`useNullBreakdown`, `useCheeseNullStats`) stay the same — only the data source under `fetchContractNulled` changes.

## Out of scope

- Changing the 24h/7d/30d windows (they remain Hyperion-derived and can still be slightly off when the indexer lags — acceptable, since those are inherently windowed).
- Reworking the Hyperion endpoint-picking / staleness logic.
- Any change to how nulling transactions are submitted.

## Verification

- After implementation, open the CHEESENull page: the popover's `cheeseburner` row should match the bottom bar's "Total CHEESE Nulled" (currently 1006 vs 845).
- The sum of per-contract `amount` values in the popover should equal (or very closely match) the bottom bar total, modulo any contract that legitimately has no on-chain counter and still uses Hyperion.
