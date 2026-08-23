# Show unstaking / refundable WAX in the CHEESEWallet account section

## Confirmed on-chain

Queried `eosio::refunds` for `ram.cheese`:

```text
owner: ram.cheese
cpu_amount: 1400.00000000 WAX
net_amount: 0.00000000 WAX
request_time: 2026-08-22T00:20:01 UTC   -> claimable 2026-08-25T00:20:01 UTC
```

Its `get_account` shows `core_liquid_balance: 0.00000000 WAX` and self-delegated CPU/NET of ~105.4 WAX. So the account really holds ~1505 WAX, but the account section computes `totalWaxBalance = liquid + selfCpuStaked + selfNetStaked` in `src/components/wallet/WalletResources.tsx`, which excludes the 1400 entirely. That is exactly the discrepancy you saw.

The refund data is already fetched, but only inside `StakeManager`'s "Refund" tab (`src/components/wallet/StakeManager.tsx`), so it is invisible from the account summary.

## What changes

In the CHEESEWallet account section:

1. **New "Unstaking" figure** next to Liquid and Staked, showing the pending refund total (`cpu_amount + net_amount`).
2. **Include it in Total WAX Balance**, so the total becomes `liquid + staked + unstaking`. The USD figure follows the same total. This is the number that was wrong.
3. **State-aware label and styling:**
   - While the 3-day timer runs: `Unstaking` with a countdown, e.g. `1400.00000000 WAX — ready in 2d 4h`, in muted/amber styling.
   - Once `request_time + 3 days` has passed: `Refund Ready` with a clear highlight (cheese/green accent) and the claimable amount, so it is obvious at a glance.
4. **Nothing when there is no refund row** — no empty placeholder, so accounts with no pending unstake look exactly as they do today.

Optional, tell me if you want it: make the "Refund Ready" indicator a button that jumps straight to the Stake manager's Refund tab, or claims inline. Default in this plan is indicate-only, since the existing Refund tab already performs the claim.

## Technical notes

- `src/components/wallet/WalletResources.tsx` — add a `refunds` fetch (`code: eosio`, `scope: accountName`, `table: refunds`, limit 1) alongside the existing `fetchResources` / `fetchRamPrice` calls, using `waxRpcCall` for the same multi-endpoint fallback. Derive `refundTotal` and `refundReady` from `request_time + 3 days`. Include `refundTotal` in `totalWaxBalance`.
- `get_account` also returns `refund_request` directly, which matches the table row, so the extra call can be avoided — the plan uses the `refund_request` field already present in the existing `get_account` response and extends the `AccountResources` interface with it. One fewer RPC round trip.
- Countdown reuses the same 3-day formula already implemented in `StakeManager.getRefundAvailability`; extract it into a small shared helper (e.g. exported from `WalletResources.tsx`, where `parseWaxBalance` and `parseStakedWeight` already live) so the two views can never disagree.
- Ticking: a 1-minute interval is enough for a day/hour countdown; no per-second timer.
- Refresh: the existing refresh button re-reads `get_account`, so the refund figures update with it automatically.
- Purely presentational — no transaction logic changes, and the existing Refund tab keeps working as-is.
