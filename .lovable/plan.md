## Goal

Update the main CHEESEUp page (`/powerup`) so users can choose between paying with CHEESE (default) or paying with WAX, mirroring the dual-mode flow already in CHEESEWallet's `RentResourcesManager`.

## Changes

### 1. `src/components/powerup/PowerUpCard.tsx` (main edit)

- Add a Tabs control with two tabs: **CHEESEUp** (default) and **WAX PowerUp**.
- Keep the existing recipient input above the tabs (shared by both modes).
- **CHEESE tab**: keep current behavior unchanged (CheeseInput for CPU/NET, ResourceEstimate, "Power Up Now" → `cheeseburger::transfer` to `cheesepowerz`, success dialog).
- **WAX tab**: add WAX CPU + WAX NET numeric inputs (step `0.00000001`), reuse `usePowerupEstimate` with `isWaxMode=true`, and submit `eosio::powerup` action:
  - `payer: accountName`, `receiver`, `days: 1`
  - `cpu_frac: floor(waxCpu * 10000)`, `net_frac: floor(waxNet * 10000)`
  - `max_payment: "{cpu+net.toFixed(8)} WAX"`
  - Uses Greymass Fuel via `getTransactPlugins(session)` (same as CHEESE path).
- On WAX success, reuse the existing success dialog (show "WAX spent" instead of CHEESE spent) and call `onBalanceRefresh` / `onStatsRefresh`.
- Error handling via existing `parseTransactError` / `closeWharfkitModals` pattern.

### 2. No other files changed

- `PowerUp.tsx` page, hero, leaderboard, stats — untouched.
- Daily-powerup script — untouched.
- No changes to the design system, hooks, or shared components (everything needed already exists: `usePowerupEstimate` supports `isWaxMode`, `getTransactPlugins`, etc.).

## Technical notes

- WAX powerup tx shape is copied verbatim from `RentResourcesManager.handleWaxPowerup` so behavior matches CHEESEWallet exactly.
- Default selected tab = `cheese` so existing UX is preserved.
- Recipient validation (`/^[a-z1-5.]+$/`, ≤12 chars) stays as-is and gates both modes.
