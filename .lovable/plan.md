# CHEESESwap: split trades across Alcor, Defibox and TacoSwap

## Goal
When a trade is big enough that Alcor's pools move the price, sending part of it through Defibox or TacoSwap can give a better total. CHEESESwap will compare all three and only use Defibox/Taco when it genuinely improves what you receive.

## How it will work for the user
- Same widget, same flow. The quick Alcor quote still shows first, then the final best split.
- The Multiroute panel shows each leg with its exchange logo (Alcor, Defibox, TacoSwap) and percentage, e.g. "70% Alcor · 30% Defibox".
- One signature: every leg is its own transfer inside a single transaction, so either every leg goes through or none do (no half-done swaps).
- Each leg gets its own minimum-received check, same as Alcor splits today; the total minimum shown stays your chosen slippage.
- If Defibox or Taco can't be read, the swap simply falls back to Alcor-only — never slower or worse than today.

## Scope (first version)
- Defibox and Taco legs can be direct (A→B) or 2 hops inside the same exchange (e.g. WAX→USDT→CHEESE on Defibox).
- A single leg never mixes exchanges mid-path (that needs a contract to hold funds between hops).
- The existing rule stays: the final route must beat Alcor's own quote, or Alcor's quote is used.

## Steps
1. **Confirm exact swap formats on-chain** — read recent real Defibox (`swap.defi`/`swap.box`) and Taco (`swap.taco`) swap transactions to confirm memo format, fee (0.3% Defibox, Taco per pool), and minimum-out behaviour. Nothing is built until these are confirmed from real transactions.
2. **Read pools** — reuse the Defibox/Taco pool readers CHEESEAnal already has, with a short cache and fetched as soon as both tokens are picked (same as Alcor prefetch).
3. **Quote maths** — constant-product (x·y=k) pricing with each venue's fee, exact integer rounding like the contracts.
4. **Combine** — take Alcor's best split curve plus the Defibox/Taco curves and allocate the amount in 1% steps to whichever leg gives the most extra output (same 1% granularity as today), in the background worker.
5. **Build the transaction** — one transfer per leg to the right contract with the right memo; Greymass Fuel unchanged.
6. **Show it** — venue logos and percentages in Multiroute.
7. **Verify** — unit tests against recorded pool data (maths matches contract output to the smallest unit); compare quotes vs Alcor-only for WAX→CHEESE, CHEESE→WAX, WAX→USDT at small and large sizes; confirm the transaction builds correctly; a tiny real swap signed by you is the final proof (I can't sign).

## Technical details
- New `src/lib/ammQuote.ts`: CPMM `getAmountOut` per venue (fee, integer floor), 2-hop path enumeration within a venue, output curve at 1% buckets.
- `alcorQuoteCore.ts` / worker: after Alcor's split curve, greedy marginal allocation across Alcor + AMM legs; Alcor's internal split kept as one "Alcor" bucket.
- `SwapSplit` gains `venue: 'alcor' | 'defibox' | 'taco'`, `contract`, `memo`; `swapApi.ts` multi-transfer builder routes by venue.
- `useSwapRoute`: SDK-vs-HTTP comparison unchanged; AMM failures degrade to Alcor-only.
- `MultiRoutePanel`: `VenueLogo` per row.
