# Add Taco and Defibox liquidity to CHEESEAnal and CHEESEAir

Today both the daily snapshot and the airdrop provider lists only look at Alcor. Confirmed on-chain right now, there is real CHEESE liquidity on two more WAX exchanges:

- **Taco** (`swap.taco`): CHEESE/HOLE (~15,019 CHEESE), CHEESE/WAXUSDC (~4,072), CHEESE/LSWAX (~2,006), CHEESE/WAXWETH (~1,876), CHEESE/WAX, plus small CHEESE/PXJ, CHEESE/RUGG, CHEESE/BANANAZ, CHEESE/EE, CHEESE/AA.
- **Defibox** (`swap.box`): CHEESE/WAXUSDC (~9,887 CHEESE), WAX/CHEESE (~6,245), CHEESE/LSWAX (~1,064), CHEESE/RUGG (~59).

Both are classic pool exchanges: each provider holds a share token, so a provider's holding is `their share ÷ total shares × pool reserves`. Provider lists come from the share-token balances (about 1,078 accounts on Defibox and 3,029 on Taco), which is well within what a once-daily job can read.

## What you will get

**CHEESEAnal (`/anal`)**
- A venue filter at the top: **All / Alcor / Taco / Defibox**. Every box, chart, pool list, and account panel re-reads against the chosen venue, with All as the default.
- Pool rows show which venue they come from, so the same pair can appear once per venue and once combined.
- Account detail totals a person's liquidity across all three exchanges, and the existing per-pool drill-down works for the new venues too.
- CSV exports gain a venue column and respect the active filter.

**Pairs covered**
- The seven pairs already tracked (WAX, WAXUSDC, WAXWBTC, HOLE, LSWAX, LSW, WAXWETH) always, on every venue where they exist.
- Any other CHEESE pair on any venue is picked up automatically once it holds more than $100, and kept in history from then on.

**CHEESEAir (`/air`)**
- The "liquidity providers" snapshot mode gains the same venue choice, and All combines Alcor, Taco and Defibox providers into one list ranked by total USD value, so an airdrop can reach every CHEESE liquidity provider.

**Prices**
- Each snapshot also records the CHEESE price in every tracked pair, on every venue: price in the paired token, and the same price converted to USD.
- CHEESEAnal gets a price series per pair, so you can compare CHEESE/WAX on Alcor against Taco and Defibox over time, plus the venue-average CHEESE price.

**History reset:** since Taco, Defibox and the new price fields would otherwise start partway along the charts, we wipe the stored days and re-run from day one. The workflow already supports this — Actions → CHEESEAnal LP History → Run workflow with `reset` set to `1`, which clears the data branch and records a fresh first snapshot on the new format.

## Technical detail

Read paths (all verified against `wax.greymass.com`):
- Taco: `swap.taco` tables `pairs` (id, `pool1`/`pool2` with quantity+contract, `supply`) and `accounts` (scope = account, share-token balances). Providers enumerated with `get_table_by_scope` over `swap.taco/accounts`, then one `get_table_rows` per scope, filtered to CHEESE pair share symbols. Taco farm-staked shares in `staked`/`pools` will be inspected during implementation and folded in if they hold pair shares.
- Defibox: `swap.box` table `pairs` (id, token0/token1, reserve0/reserve1, `liquidity_token`); shares live on `lptoken.box`, providers enumerated the same way over `lptoken.box/accounts`.
- USD valuation: reserves priced with Alcor `/tokens` `system_price` (token→WAX) bridged through WAXUSDC, same bridge the sampler already uses for `cheeseUsd`.

Code changes:
- `src/lib/lpPools.ts` — add a `venue: 'alcor' | 'taco' | 'defibox'` field to `TrackedPair`, `LpPoolSnapshot`, and `LpIndexPool`; make pair keys venue-scoped (`alcor:wax-eosio.token`) with a legacy fallback that reads old un-prefixed keys as Alcor; add the >$100 inclusion rule; keep the module dependency-free.
- New `src/lib/lpVenueTaco.ts` and `src/lib/lpVenueDefibox.ts` — pair discovery, share-holder enumeration, pro-rata reserve split, all returning the existing `LpPoolSnapshot` shape. Shared chain-RPC helper with retries/timeouts and multi-endpoint fallback, matching existing resilience patterns.
- `scripts/lp-history/sample.ts` — run all three venues, tolerate one venue failing (record the others and mark the day partial rather than aborting).
- `src/lib/lpLive.ts` and `src/hooks/useLpHistory.ts` — live read and history read per venue, plus venue-aware filtering/aggregation helpers.
- `src/components/anal/*` and `src/pages/CheeseAnal.tsx` — venue toggle, venue-aware overview/pool/account views, venue column in CSV (`src/lib/lpCsv.ts`).
- `src/lib/airdropAlcorLp.ts` (renamed concept, kept file plus new venue readers) and the CHEESEAir snapshot card — venue selector and merged provider list.
- Unit tests for the pro-rata share maths, the >$100 rule, price derivation, and merged provider aggregation.

Prices: added to `LpPoolSnapshot`/`LpIndexPool` as `priceInPaired` and `priceUsd`. Alcor pairs use the pool's current tick price; Taco and Defibox use `reserveOther / reserveCheese`; USD comes from the WAXUSDC bridge. Chart selectors in `AnalOverview`/`AnalPoolDetail` gain a price metric.

Since history is wiped and re-recorded with `reset=1`, no backwards-compatible key fallback is needed — pair keys become venue-scoped (`alcor:wax-eosio.token`) outright. Workflow schedule and data-branch layout are unchanged.
