# CHEESEWallet cleanup — staged plan

Goal: tidy the code without changing what users see, what they sign, or any fees. Each stage is checked (tests + build + signed-out page load) before the next starts. No wallet transactions are signed during testing.

## Findings
- Biggest files: Alcor farm logic (~1,190 lines), Alcor Farm Manager screen (~890), Compound All dialog (~700), Transfer dialog (~590), Create Alcor Farm dialog (~490).
- Only one wallet test exists (wallet server fetching). Farm/position math, compound batching and transfer building are untested.
- Stake, RAM and Resources screens use their own fixed server lists instead of the shared live health check (breaks the endpoint rule).
- Transfer dialog still links one token table to waxblock.io (contract-table links were deliberately kept — will stay unless you say otherwise).
- Wojak unbox falls back to a missing placeholder image (same 404 spam we fixed in CHEESEDrip).
- Wording says "burn" in Wojak unbox and the NFT send screen.

## Stage 1 — Safety net (tests only)
Lock current behaviour: Alcor position sizing from pool price, farm reward/claim action building, Compound All batching, transfer/NFT send action shapes, RAM/stake amount formatting.

## Stage 2 — Small safe fixes
- Stake, RAM and Resources read through the shared health-checked server order.
- Wojak images use the shared NFT image fallback instead of the missing placeholder.

## Stage 3 — Split Alcor farm logic
Break `alcorFarms` into focused parts (API reads, on-chain position reads, math, action builders) behind the same entry point, so nothing that imports it changes.

## Stage 4 — Break up big screens
Extract position cards, farm rows and dialog sections from Alcor Farm Manager, Compound All, Transfer and Create Alcor Farm into one-component-per-file pieces; screens keep owning their state.

## Stage 5 — Rendering and dead code
Memoize repeated rows/cards, remove only code proven unused, add a wallet AGENTS.md with the conventions.

## Decisions needed (left unchanged unless you say)
1. "Burn" wording in Wojak unbox ("burns and mints") and NFT "burn" — switch to "nulled"? Note: NFT burning genuinely destroys the NFT on chain, so "nulled" could be misleading there.
2. The waxblock.io token-table link in Transfer — keep as a contract-table link?

## Technical notes
- Barrel re-export keeps `src/lib/alcorFarms.ts` import paths stable.
- Endpoints via `resolveEndpoints()` / `applyHealthOrder()`.
- Image fallback via shared `ipfsGateways`/`nftMedia` helpers.
