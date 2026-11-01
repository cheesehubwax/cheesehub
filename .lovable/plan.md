# Update Contract Monitor and Ecosystem Guide

## 1. Contract Monitor (/admin)

**New card: crypt.cheese** (CHEESECrypt fee router)
- Status: Live / Paused (from the `config` table's `paused` flag)
- Per-part fee, per-recipient fee, null/liquidity split (80/20), max recipients, max parts
- Pending payments: count of in-flight rows in the `pending` table (should normally be 0 — any rows mean someone's payment is waiting for `reclaim`; shown as a warning)
- Liquid CHEESE balance of crypt.cheese (should be ~0 since it holds no funds; anything above a dust amount shows a warning)
- Note found while checking: the live `config` table is currently empty, meaning `setconfig` has never been run and the contract is using its built-in defaults. The card will say "Using built-in defaults" rather than "Config unavailable" in that case.

**cheesebannad card** — add a "Revenue split" row: 10% cheeseburner / 20% cheesepowerz / 20% ram.chz / 50% CHEESE buyback (66% nulled / 34% xcheeseliqst).

**cheesepowerz card** — add the reward automation figures:
- Liquid WAX vs the 400 WAX reserve (warn if above 400 for over an hour, i.e. staking didn't run)
- CPU self-staked
- Last vote claim time and next eligible claim (last claim + 24h 5m); warn if a claim has been overdue for more than ~2 hours
- `compound` permission present and linked to `claimgbmvote` + `delegatebw` (critical if missing)

## 2. Ecosystem Guide (/admin/guide)

- **CHEESEAds**: description updated to mention ram.chz as a revenue destination (flow chart already shows 10/20/20/50).
- **CHEESEUp**: fix outdated text — reserves now funded by cheesebannad 20% (flow chart currently still says 25%); add a section on the reward automation (24h+5m claims, 400 WAX reserve, excess staked to own CPU, restricted `compound` key).
- **CHEESERam**: note that ram.chz now also receives 20% of ad rentals.
- **New entry: CHEESECrypt** (`crypt.cheese`, CHEESE team) — end-to-end encrypted messaging; contract is a zero-custody fee router; per-part fees with 80% nulled / 20% xcheeseliqst; 100 CHEESE key creation and listing fees via `payfee`; `reclaim` refunds orphaned payments; flow diagram included.
- **Automation list**: add "Power-compound runner" (hourly at minute 23, claims vote rewards every 24h+5m, stakes liquid WAX above 400 to CPU, signed with the restricted `cheesepowerz@compound` key). Update "Daily CPU powerup" text so it no longer says that job claims vote rewards.

## Technical details
- New fetchers in `src/lib/adminData.ts`: crypt.cheese config/pending/balance, cheesepowerz voter info (`eosio::voters`), account permissions (`get_account`), liquid WAX; all through the existing endpoint-health fallback.
- Wire them into `useContractConfigs` with `.catch(() => null)` like the others.
- Small tests for the new warning rules (pending rows > 0, powerz liquid > 400, overdue claim, missing link).
- No contract changes needed — this is display only.
