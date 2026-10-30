# CHEESEAir stages 1–2

## Completed
- Characterized token equal/fixed/pro-rata allocation, exact decimal parsing, NFT allocation/shortfalls, RAM exclusion/splitting and resource purchase minima before extraction.
- Separated allocation into `useAirAllocation`, cost/resource derivation into `useAirCosts`, and wallet preparation/delivery into `useAirdropRunner`.
- Kept snapshot selection, row discovery, CSV exports and hot-reload context identity in the provider; reduced it from 1,489 to 686 lines.
- Kept valid payout algorithms, transaction payloads, inter-batch delays, failed-batch continuation and resource-purchase abort behaviour unchanged.
- Enforced the existing terms/error gate inside the sending function, blocked concurrent invocation and required transaction IDs for confirmed resource/delivery logs.

## Remaining audit findings (outside these stages)
- Token pro-rata needs explicit finite/nonnegative weight validation and protection against millionth-quantization drift creating negative shares. A reproducible negative-weight input can overallocate after filtering.
- RAM planners need coherent-limit validation and infeasible-split handling. `sliceRamUnits(11n, 6n, 10n)` cannot produce legal slices yet returns an oversized slice.
- Resource splitting stops at 50 iterations and can silently return an incomplete large purchase plan; below-minimum and final-tail purchases can increase planned spend.
- Sending CHEESE needs one combined balance check for distribution plus actual resource purchase totals, not separate checks.
- Holder/asset input uniqueness should be validated at trusted boundaries; large floating-point balance conversions need precision safeguards.
- Preparation cancellation, immutable per-run export snapshots and account-switch handling warrant a dedicated lifecycle review.
- Context subscription splitting/table input performance and the partial snapshot warning are later cleanup stages, not changed here.

## Verification boundary
Automated tests exercise allocation, estimates, action payloads, terms enforcement, duplicate prevention, resource failures, missing confirmations, partial delivery and cancellation. These do not establish successful WAX delivery. Real wallet signing and chain readback require the user's wallet; no funds were moved during this cleanup.