# CHEESEAir — token & NFT airdrop dashboard

Port the `token-drop-manager` tool into CheeseHub as a new dApp at `/air`, rebuilt in CheeseHub's visual language and wired to CheeseHub's existing wallet, RPC and CHEESE plumbing. No header link (same as CHEESERam was at launch) — reachable only by direct URL.

## What the dApp does

1. **What to send** — Token (contract + symbol, auto-detects precision and supply) or NFTs (pick one of your own collections, then a template; one NFT per recipient).
2. **Airdrop to holders of** — snapshot holders of any WAX token, or holders of an AtomicAssets collection / schema / template. Loads up to 5,000 holders with balances.
3. **Distribution** — Equal split, Fixed amount each, or Pro-rata by holding. Memo, batch size (actions per transaction) and a minimum-balance filter.
4. **Holders list** — every holder checked by default, individually deselectable, with Top 10/50/100, All, None shortcuts and a live selected count.
5. **Costs** — recipients, transaction count, estimated CPU/NET, and how many recipients need a new token row (real on-chain check, not a guess). Shows the CHEESE cost of the CPU/NET and RAM needed, plus current CHEESE per ms / per KB prices and your CHEESE balance.
6. **Run** — buys the required RAM with CHEESE through `ram.chz` (minimum 10 CHEESE, the excess RAM stays in your account and is sellable), tops up CPU/NET via `cheesepowerz` only if you are short, then signs the transfers batch by batch with a live per-batch log of WAXBlock links, a cancel-after-current-batch button, and a CSV download of the recipient list.

Scheduling a drop for a later time is not in the source tool and is not included here.

## CheeseHub styling

- Standard `Layout` (header, banner ads, footer), `py-20` hero with the radial gradient, floating clickable orb with fart sound, heading in the house pattern: icon → `CHEESE` (yellow) + `Air` → `BETA` tag → icon.
- An info dropdown to the right of the title, matching `RamInfoDropdown`, explaining snapshots, distribution modes, batching and the CHEESE resource purchases.
- Semantic tokens only (`text-cheese`, `bg-card`, `border-border`), shadcn `Card`/`Tabs`/`Input`/`Table`, OpenMoji icons instead of raw emoji, `ResourceGauges` above the cost panel so CPU/NET/RAM are visible while configuring.
- Mandatory "I have read and agree to the Terms of Use" checkbox gating the airdrop button, using the shared `TermsCheckbox`.
- Orb art: I will generate a CHEESE airdrop/parachute orb in the existing orb style and bundle it locally (so it works on GitHub Pages) unless you send one.

## Technical notes

- **Route**: `/air` added to `src/App.tsx`; new page `src/pages/Air.tsx`. `Header.tsx` untouched.
- **Pure math**: port `src/lib/airdrop.ts` verbatim (base-unit bigint amounts, largest-remainder rounding so totals match exactly, batching, resource estimates, warnings, NFT assignment) and `resources.ts` as `src/lib/airdropResources.ts` (CHEESE ⇄ RAM/powerup math with the 1.1× RAM and 1.25× CPU margins).
- **Chain reads**: the source runs these as TanStack Start server functions; CheeseHub is a static SPA, so they become browser-side readers in `src/lib/airdropChain.ts` built on the existing `fetchWithFallback` / `waxRpcFallback` helpers — Hyperion `get_token_holders` with `get_table_by_scope` fallback, AtomicAssets holder/inventory queries with the project's existing endpoint fallback list, `get_currency_stats`, existing-row checks, account resources, RAM price. Exposed through react-query hooks in `src/hooks/useAirdrop*.ts` with the project's caching conventions.
- **CHEESE constants**: reuse the existing `CHEESE_RAM_CONTRACT` (`ram.chz`), `cheesepowerz` and CHEESE token constants already in `src/lib/cheeseRam.ts` / `waxConfig.ts` rather than adding a duplicate `cheese.ts`; add only the airdrop-specific `MIN_RAM_PURCHASE_CHEESE = 10` and the powerup/RAM memo helpers.
- **Signing**: the source's own WharfKit wallet layer is dropped. All transactions go through CheeseHub's `WaxContext` / `useWaxTransaction`, so Greymass Fuel and the shared error parsing and TX-ID verification apply. Batches sign sequentially with the existing 1.2s spacing and per-batch error capture; a failed batch stops the run without losing the log.
- **Components** (`src/components/air/`): `AirSendCard`, `AirSnapshotCard`, `AirDistributionCard`, `AirHoldersTable` (virtualized for large lists), `AirCostPanel`, `AirRunPanel`, `AirInfoDropdown` — keeping each file small instead of one 1,500-line page.
- Balances, gauges and CHEESE prices refresh after the resource purchases and after the run, using the same staggered refetch pattern as CHEESERam.

## Follow-ups (not in this change unless you want them)

- CHEESEAir disclosures in Terms of Use and the Disclaimer.
- A header link once you want it public.
