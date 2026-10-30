# CHEESEAir stages 1–2

## Completed
- Characterized token equal/fixed/pro-rata allocation, exact decimal parsing, NFT allocation/shortfalls, RAM exclusion/splitting and resource purchase minima before extraction.
- Separated allocation into `useAirAllocation`, cost/resource derivation into `useAirCosts`, and wallet preparation/delivery into `useAirdropRunner`.
- Kept snapshot selection, row discovery, CSV exports, public exports and hot-reload context identity in the provider; reduced it from 1,489 to about 690 lines.
- Kept valid payout algorithms, transaction payloads, inter-batch delays, failed-batch continuation and resource-purchase abort behaviour unchanged.
- Enforced the existing terms/error gate inside the sending function, blocked concurrent invocation and required transaction IDs for confirmed resource/delivery logs.
- Next safety stage: token/NFT pro-rata now uses exact decimal integer ratios and rejects invalid weights; impossible RAM splits and top-ups beyond 50 purchases fail before spending. Allocation errors surface as blocking warnings. Combined delivery plus actual CPU/RAM budgets are checked in CHEESE base units; unknown/unsafe CHEESE balances block signing.
- Phase 3: six memoized consumer-shaped context slices preserve HMR identities and original state ownership. Stable query fallbacks and token metadata prevent incidental allocation invalidation. Holder rows are memoized with per-account values, retaining the existing first-500 display cap and full-list allocation (there was no pagination state to move). Provider/row render-count tests prove snapshot keystrokes, memo, terms and batch-size edits leave unrelated rows unchanged; fixed selection changes one row, while equal-split changes correctly refresh all changed payouts.

## Remaining audit findings (outside these stages)
- Holder/asset input uniqueness should be validated at trusted boundaries; large floating-point balance conversions need precision safeguards.
- Preparation cancellation, immutable per-run export snapshots and account-switch handling warrant a dedicated lifecycle review.
- Snapshot completeness/source polish remains a later cleanup stage; context subscription splitting and table input performance are complete.

## Verification boundary
Automated tests exercise allocation, estimates, action payloads, terms enforcement, duplicate prevention, resource failures, missing confirmations, partial delivery and cancellation. These do not establish successful WAX delivery. Real wallet signing and chain readback require the user's wallet; no funds were moved during this cleanup.