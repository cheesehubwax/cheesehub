## Problem

Section 7.10 of the Disclaimer currently states:

> "Swap routing, price calculations, and minimum received amounts are determined by Alcor's public API and on-chain pool liquidity — CHEESEHub merely displays this information for convenience."

This is no longer accurate. `useSwapRoute` now runs two independent quote engines in parallel:

1. **Alcor HTTP API** (`fetchSwapRoute`) — Alcor's public `/swapRouter/getRoute` endpoint.
2. **Custom browser SDK router** (`computeAlcorTrade` in `src/lib/alcorRouter.ts`) — fetches on-chain Alcor pool and tick data directly, then runs `@alcorexchange/alcor-swap-sdk`'s `bestTradeWithSplit` client-side to build split routes.

The widget picks whichever route produces the better output (or input, for exact-output). CHEESEHub is therefore no longer "merely displaying" Alcor's API data; it is actively computing competing routes and selecting one.

## Proposed change

Update section 7.10 in `src/pages/Disclaimer.tsx` to:

- Rename the subsection from "CHEESESwap (Alcor Swap Widget)" to "CHEESESwap (Smart Router)".
- Explain that CHEESESwap compares Alcor's public HTTP quote against a custom client-side router that reads the same on-chain Alcor pools.
- Clarify that the displayed route is the better of the two computed quotes, but is still indicative and subject to slippage / pool changes.
- Keep all existing legal protections: non-custodial, user-signed, Alcor contracts, no execution/intermediation guarantees.

### Suggested new wording

```text
7.10 CHEESESwap (Smart Router)

CHEESESwap provides an embedded interface for token swaps executed against Alcor Exchange's smart contracts (including swap.alcor) deployed on the WAX blockchain. Alcor Exchange is a third-party decentralised exchange not affiliated with, owned by, or controlled by CHEESEHub or the CHEESE DAO. CHEESEHub does not custody, hold, pool, or have access to any user funds at any point during a swap. All swap transactions are constructed in the user's browser, signed by the user's own wallet provider, and executed directly against Alcor's on-chain smart contracts. CHEESEHub does not execute, intermediate, settle, match, or arrange any swap on behalf of any user.

CHEESESwap quotes are produced by comparing two independent route computations in the user's browser: (a) Alcor Exchange's public HTTP quote API, and (b) a custom client-side router that fetches the same public Alcor pool and tick data and calculates split-route trades using the Alcor swap SDK. CHEESESwap displays and proposes whichever of these two computed routes returns the better expected output (or, for exact-output swaps, the lower required input). Because both engines use the same underlying on-chain liquidity, neither CHEESEHub nor any third party controls or sets the price.

Price quotes, price impact estimates, expected output, minimum received amounts, and route details shown in the interface are indicative only and may differ from the final on-chain execution due to slippage, pool depth changes, concurrent transactions, or differences between the quoted block and the execution block. CHEESEHub makes no guarantee regarding swap execution, pricing accuracy, or availability of the Alcor API or on-chain data. Users are solely responsible for reviewing and confirming all transaction details before signing.
```

## Files changed

- `src/pages/Disclaimer.tsx` — update section 7.10 heading and paragraph.

## Out of scope

- No logic changes to the swap widget or SDK.
- No changes to other disclaimer sections unless requested.
