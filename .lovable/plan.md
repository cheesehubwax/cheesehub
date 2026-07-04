## Background

- Current router: Alcor's public HTTP `/getRoute` — always 100% single-path, no splitting.
- Previous alternative in `cheesehub` history: **WAX on Edge (WoE)** — a WAX-native DEX aggregator (`swap.we` contract, `waxonedge.app`) that does split routing across Alcor pools + spot markets. It was removed when WoE's public API went down.
- WoE is back online (site + API link live at `waxonedge.app`, `@waxonedge/swap` still published on npm).
- Approach chosen: **best-of-both** — quote from WoE and Alcor's HTTP router in parallel, pick the route with better output for the user.

## Step 1: Archive the current SDK plan

- Move `.lovable/plan.md` → `.lovable/archive/plan-alcor-swap-sdk-DEFERRED.md` (mirrors the existing `plan-token-farms-tf-waxdao-DROPPED.md` convention).
- Uninstall `@alcorexchange/alcor-swap-sdk` from `package.json` (installed last session, unused). Removes bundle weight and stops appearing in dependency scans.
- Delete any stub files created while investigating the SDK (none confirmed yet — check before uninstall).

## Step 2: Recover the old WoE integration from git history

Before writing anything new, look at how `cheesehub` did it originally so we don't re-invent the wire format. Two candidate sources:
1. `bewbzz/cheesehub` git log — search for `waxonedge`, `swap.we`, `WoE`.
2. `@waxonedge/swap` npm package internals — the Vue component's `config` type exposes `API`, `RATES_API`, `CHAIN_API`, and the `sign` event returns ready-to-sign `action[]`. Unpacking the tarball reveals the exact route/quote endpoints and the memo format the `swap.we` contract expects. This is the authoritative source.

Output of this step: a documented `WoE quote request → response → wharfkit actions` contract before any code changes.

## Step 3: New router adapter `src/lib/woeRouter.ts`

- `fetchWoeRoute(tokenIn, tokenOut, amount, slippage, receiver, tradeType, signal)` → returns our existing `SwapRoute` shape (so `MultiRoutePanel`, min-received UI, and the submit path all keep working unchanged).
- Maps WoE's split routes into `route.swaps[]` — one entry per split with `percent`, per-hop `route` (pool IDs / market IDs), `input`, `output`, `minReceived`, `maxSent`, `memo`.
- Supports both `EXACT_INPUT` and `EXACT_OUTPUT` if WoE exposes both; otherwise document the gap and fall back to Alcor for exact-output.
- Emits `action[]` for `session.transact`. When WoE returns multiple splits, that will be multiple `transfer` actions to `swap.we` (or the routed contracts) in one transaction — same pattern the WoE npm component uses via its `sign` event.

## Step 4: Best-of-both aggregation in `src/lib/swapApi.ts`

Rewrite `fetchSwapRoute` to:

```text
1. Kick off in parallel:
     a. fetchWoeRoute(...)      (new)
     b. fetchAlcorRoute(...)    (current HTTP /getRoute call)
2. Wait for both with Promise.allSettled + a hard timeout (e.g. 4s).
3. Selection:
     - EXACT_INPUT  → pick the route with the higher `output`.
     - EXACT_OUTPUT → pick the route with the lower `input`.
     - Tie / one missing → prefer WoE (splits are typically better on realistic sizes).
     - Both fail      → surface the error the way we do today.
4. Tag the winning route with `route.source: "woe" | "alcor"` so the UI can display it (small badge under the route panel, matching how Alcor labels aggregator sources).
```

`useSwapRoute` needs no shape changes — it already consumes `SwapRoute`. Query cache key gains `source` implicitly via the returned data.

## Step 5: UI additions (minimal)

- `MultiRoutePanel` already renders `route.swaps[]` with overlapping token pairs and per-split % — it will "just work" once WoE returns splits.
- Add a small "via WaxOnEdge" / "via Alcor" label next to the "1 X ≈ Y" summary row so the user knows which router won this quote.
- No other UI changes.

## Step 6: Submit path (`CheeseSwapWidget.handleSwap`)

- `normalizeRouteActions(route, ...)` in `swapApi.ts` already normalizes single-transfer routes. Extend it to handle `route.source === "woe"` and emit **N transfer actions, one per split**, each with its own `swap.we` memo — matching WoE's on-chain contract. Alcor branch stays as-is.
- Terms-confirmation gate and Greymass Fuel plugins remain untouched (per project memory).

## Step 7: Verification checklist before shipping

- Small WAX → CHEESE swap: WoE should return a single-hop route similar to Alcor's; outputs within a few basis points.
- Large WAX → some low-liquidity token: WoE should split, Alcor should not; `MultiRoutePanel` should show 2+ rows with percents summing to 100.
- WoE down (simulate by blocking the domain): Alcor fallback still produces a route, no user-visible degradation.
- Both down: current error banner still fires; nothing regresses.

## Files touched

- `.lovable/plan.md` → moved to archive
- `.lovable/plan.md` (new) — this plan while active
- `package.json` — remove `@alcorexchange/alcor-swap-sdk`
- `src/lib/woeRouter.ts` (new)
- `src/lib/swapApi.ts` — `fetchSwapRoute` becomes best-of-both; `normalizeRouteActions` handles WoE splits
- `src/components/swap/MultiRoutePanel.tsx` — optional "via ..." badge (single line)
- No changes to `useSwapRoute`, `MultiRoutePanel` iteration logic, `CheeseSwapWidget` core flow, terms gate, or wharfkit setup

## Open items to resolve during Step 2 (not blockers for approval)

- Exact WoE quote endpoint URL and response schema (recovered from the npm tarball + old cheesehub commits).
- Whether WoE requires an API key now that it's back (docs page says "WaxOnEdge API" in the nav — will confirm).
- Memo format for multi-split `swap.we` transfers.

If any of these turn out materially different from what's assumed above, I'll come back with a revision before implementing rather than papering over it.
