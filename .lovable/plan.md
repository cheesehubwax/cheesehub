# Refresh the Admin Ecosystem Guide + add ram.chz to the Contract Monitor

Two admin pages are out of date: the Ecosystem Guide misses the newest tools, and the Contract Monitor has no card for the RAM contract.

## 1. Ecosystem Guide (`/admin/guide`)

Add the missing tools, keeping the existing accordion + flow-diagram style:

- **CHEESERam** (`ram.chz`) — buy RAM with CHEESE, sell RAM back for CHEESE. Flows: CHEESE in is nulled / routed to x-CHEESE liquidity; WAX pool funds the RAM purchase; WAX pool is topped up by claimed vote rewards (anyone can trigger the claim from the page) plus allocations from other contracts. Sell path pays CHEESE out of the contract's CHEESE pool with spread/haircut applied.
- **CHEESEAir** — airdrop any WAX token, NFT or RAM to token holders, NFT collectors or Alcor liquidity providers. No dedicated contract: signs `cheeseburger`/token transfers, `atomicassets::transfer`, and RAM buys via `ram.chz`. Snapshot sources, three distribution modes (fixed each, equal split, pro-rata), batching, CSV export, optional sell-RAM-for-CHEESE box.
- **CHEESESwap** — refresh to mention multi-route splitting across Alcor pools.
- **HOLE sister token** (`hole.cheese`) — noted alongside CHEESE, price shown on the homepage bar via Alcor pool 11051.

Also add a new **Automation** section at the bottom of the guide covering the scheduled jobs:

- Daily CPU powerup script — powers up eligible stakers and claims `cheesepowerz` vote rewards when available.
- RAM price history recorder — samples the WAX and CHEESE RAM price twice daily into a data branch, which feeds the CHEESERam history chart.
- Watchdog job that alerts when the daily powerup run fails.

Existing entries stay; only wording that is now wrong (e.g. "burn" phrasing, fee splits that changed) gets corrected — no invented numbers. Anything not confirmable from the code is described qualitatively rather than with a made-up percentage.

## 2. Contract Monitor (`/admin`)

Add a compact `ram.chz` card in the contract grid, placed after `cheesepowerz`, matching the other cards' look:

- Status badge (enabled / disabled), sell enabled
- Min / max CHEESE per buy
- Liquid WAX reserve and CHEESE pool
- Totals: purchases, sales, CHEESE nulled, WAX claimed

Card turns critical when the contract is disabled and warns when the liquid WAX reserve is below its configured minimum or the CHEESE pool is below its minimum.

## Technical notes

- Guide data is static arrays in `src/pages/AdminGuide.tsx` (`dapps`, `FlowStep` lists) — extend those, plus a small automation list rendered under the accordion.
- Monitor: extend `src/hooks/useContractConfigs.ts` to also call the existing `fetchCheeseRamConfig`, `fetchCheeseRamStats` and `fetchContractReserves` from `src/lib/cheeseRam.ts` (each wrapped in `.catch(() => null)` like the other fetches), and render a new `ContractStatusCard` in `src/pages/Admin.tsx`.
- No contract changes, no new dependencies, no writes on chain.
