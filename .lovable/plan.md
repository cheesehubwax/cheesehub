# Fund WAX Pool — why it fails, and whether a public claim is safe

## What the error means

`missing authority of ram.chz` means the contract's `claimvotes` action currently requires the contract account's own authority (`require_auth(get_self())`, or the admin), so a normal wallet signing it is rejected. Nothing in the frontend can work around that — the permission lives in the deployed contract.

## Is a public claim button a security risk?

Not inherently, and your concern about a dry pool is the right reason to make it public. A claim action is safe to open up when all three hold:

1. It takes no arguments — the caller cannot choose a destination or amount.
2. The claimed WAX lands in `ram.chz`'s own liquid balance; nothing is paid to the caller.
3. It cannot be spammed for profit — the WAX voting-reward claim is already capped by the chain's 24-hour cooldown per account, so extra calls just fail.

The only real cost of opening it is that a stranger pays their own CPU/NET to top up your pool. The things that would make it unsafe are if `claimvotes` also performs distributions, buybacks, or transfers as a side effect — those should stay admin-gated, or the public path should do the claim only.

Your scenario is genuine: if claims only fire inside `buyram`, an empty WAX pool can block purchases, which blocks the claim that would refill it — a deadlock. A public claim breaks it.

## Plan

### 1. Contract change (required, outside this repo)

In `ram.chz`, split the authority so `claimvotes`:

- drops `require_auth(get_self())` / admin-only and instead accepts any signer (`require_auth(caller)` on whatever account signs), while the inner `eosio::claimgbmvote` is still sent with `ram.chz`'s own active permission via `permission_level{get_self(), "active"_n}`;
- keeps an internal guard: reject when the chain's 24h window has not elapsed, and reject when the estimated claimable amount is zero, so failed spam is cheap and obvious;
- does the claim only — no transfers, no splits, no state changes beyond recording `total_wax_claimed` / `last_claim_attempt`.

`eosio.code` must already be on `ram.chz`'s active permission for the inline claim, which it is today since the automatic claim inside a purchase works.

### 2. Frontend, until the contract is redeployed

Keep the card visible for everyone (it is a useful read-out of accruing rewards), but avoid handing non-admins a button that is guaranteed to fail:

- `FundWaxPoolCard` reads `useAdminAccess()`; the Claim button renders only for the whitelisted admin account.
- For everyone else the card shows the live claimable amount plus a short muted note that claims are triggered automatically on purchase.
- The existing `missing_auth` failure is surfaced as a plain-language toast ("Only the contract admin can claim right now") rather than the raw chain error, via a case added to the error parsing already used in the card.

### 3. Frontend, after the contract is redeployed

Flip a single constant in `src/lib/cheeseRam.ts` (`PUBLIC_VOTE_CLAIM = true`) that the card checks instead of `useAdminAccess()`, so the button becomes public with no other change. Cooldown, zero-amount disabling, success dialog with TX ID, and the staggered refresh of reserves/gauges/stats all already work as built.

## Technical notes

- Files touched now: `src/components/ram/FundWaxPoolCard.tsx` (admin gate, note, error mapping) and `src/lib/cheeseRam.ts` (the `PUBLIC_VOTE_CLAIM` flag).
- No change to `fetchContractVoteRewards`, the hook, or `src/pages/Ram.tsx`.
- I have not read the deployed contract source, so the exact current authority check in `claimvotes` is inferred from the error; confirm it when editing the contract.
