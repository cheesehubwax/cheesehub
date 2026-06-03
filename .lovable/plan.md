## Goal
Show the connected user's **lifetime total claimed** (per reward token) for each farm they're staked in, on the `/farm` cards — using a one-time Hyperion baseline + locally incremented running total per claim.

## Approach
1. **First load per account**: fetch full claim history from Hyperion → compute baseline totals → persist locally as the snapshot.
2. **Every subsequent claim** (made through the app): read the claimed amounts from the successful transaction's traces and **add** them to the local totals — no re-scan needed.
3. **Display** the running totals on each `FarmCard`.

This means Hyperion is only hit once per account (and on explicit "refresh history"), avoiding repeated heavy queries.

## Plan

### 1. New `src/lib/farmClaimHistory.ts`
- Types:
  ```ts
  type ClaimedToken = { contract: string; symbol: string; amount: number };
  type ClaimTotals = Record<string /*farm_name*/, ClaimedToken[]>;
  type ClaimSnapshot = {
    account: string;
    totals: ClaimTotals;
    baselineFetchedAt: number;  // unix ms — when Hyperion baseline was taken
    lastClaimSeenAt: number;    // unix ms — newest claim included (for future incremental re-syncs if needed)
    version: 1;
  };
  ```
- Storage: `localStorage` key `cheesehub:farmClaims:v1:<account>`. Helpers: `loadSnapshot(account)`, `saveSnapshot(snap)`, `clearSnapshot(account)`.
- `fetchBaselineFromHyperion(account)`:
  - Hits `get_actions` on the same Hyperion fallback list used in `src/lib/waxRpcFallback.ts`.
  - Filters: `account={account}`, `act.account=farms.waxdao`, `act.name=claim`, page size 1000, paginate until empty or 10 pages.
  - For each claim action, walk `inline_traces` (Hyperion v2 `notified` / `action_traces`) for `transfer` actions where `to === account`, parse the asset, attribute to `act.data.farm_name`. Sum into `ClaimTotals`.
  - Returns `{ totals, lastClaimSeenAt }` or throws on full-fallback failure.
- `addClaimToTotals(snap, farmName, claimed: ClaimedToken[])`: pure merge — sum into existing per-`(contract,symbol)` entry or append new.
- `useFarmClaimTotals(account)` hook:
  - On mount: if `loadSnapshot(account)` exists → return it.
  - Else: call `fetchBaselineFromHyperion`, save snapshot, return it.
  - Exposes `{ totals, isLoading, error, refetchBaseline, applyClaim(farmName, claimed) }`.
  - `applyClaim` updates state + `saveSnapshot` (single source of truth).

### 2. Hook the claim transaction
- In `src/components/farm/NFTStaking.tsx`, after the existing `claim` transaction resolves successfully:
  - Parse the resulting tx traces (already returned by `useWaxTransaction` / wharfkit response) for `transfer` actions where `to === accountName`, build `ClaimedToken[]`.
  - Call `applyClaim(farmName, claimedTokens)` from the hook (or dispatch through a tiny context if cleaner).
- If the tx response doesn't expose inline transfers reliably, fall back to using the `claimable_balances` snapshot read **immediately before** sending the claim (already available in `NFTStaking`) — that value equals what gets transferred.

### 3. `src/components/farm/FarmCard.tsx`
- Add optional prop `userClaimed?: ClaimedToken[]`.
- When present and non-empty, render above the "View Details" button:
  - `border-t border-cheese/20 pt-2 mt-2`
  - Label: `text-[10px] uppercase tracking-wider text-muted-foreground` → "You've claimed"
  - Tokens: `flex flex-wrap gap-2` with `<TokenLogo size="sm" />` + `formatAmount(amount)` + symbol in `text-cheese font-mono text-xs`.
- Undefined/empty → render nothing (no layout shift for non-stakers).

### 4. Wire into list + featured card
- `src/components/farm/BrowseFarms.tsx`: call `useFarmClaimTotals(accountName)`, pass `userClaimed={totals[farm.farm_name]}` into each `<FarmCard />`.
- `src/pages/Farm.tsx`: same hook, pass `userClaimed={totals["cheesefarm"]}` into the featured card.

### 5. UX details
- One-time baseline fetch shows no blocking spinner on the card — totals simply appear when ready. A subtle `🔄` icon in the BrowseFarms filter row triggers `refetchBaseline()` if the user ever wants to resync from Hyperion.
- On wallet change: snapshot is account-scoped, so switching wallets uses a different key (no leakage).

## Risks / notes
- **Local-only persistence**: totals live in the browser. Different browser/device = re-baseline from Hyperion (fine, that's the original cost). Documented in the refresh tooltip.
- **Missed claims outside the app** (e.g. user claims via waxblock or another dapp between sessions): would be missed by the incremental updater. Mitigation: when the snapshot's `baselineFetchedAt` is older than 24h, automatically re-baseline in the background. This keeps it accurate without spamming Hyperion.
- **Hyperion inline-trace shape** varies slightly across mirrors — parser handles both `action_traces[].act.data` and the v2 `notified` field, skipping anything it can't parse.

## Out of scope
- No server-side store; no contract changes; no USD value; no UI changes to the claim flow itself; no "since last stake" windowing (still lifetime per account per farm).
