## Fix WAX→WAXWETH split routing

Same root cause as the WAXWBTC fix: Alcor's WAX→WAXWETH split routes through **WAXUSDC** and **WAXWBTC** as intermediaries, but the low-liquidity endpoint pools (WAXUSDC↔WAXWETH, WAXWBTC↔WAXWETH) rank below the 56-pool selection cap, so our SDK only sees the direct WAX↔WAXWETH pool and misses the split.

Investigation confirmed:
- WAXUSDC↔WAXWETH pools (ids 4435, 4947) — WAXUSDC is already in `ROUTE_COVERAGE_HUB_KEYS`, so this leg is already seeded ✓
- WAXWBTC↔WAXWETH pools (ids 8568, 4941) — WAXWBTC (`waxwbtc-eth.token`) is **not** a hub key, so this endpoint pool is dropped and the WAXWBTC-intermediary split leg is never built
- WAX↔WAXWBTC connector (pool 1239) already exists and would be seeded by the connector logic once the endpoint is seeded

### Change

In `src/lib/alcorRouter.ts`, add `waxwbtc-eth.token` to `ROUTE_COVERAGE_HUB_KEYS`. This is the same deterministic-coverage mechanism we used for the WAXWBTC fix — extending the hub set to include WAXWBTC lets the seeder include the WAXWBTC↔WAXWETH endpoint pool plus its WAX-side connector before the ranked cap fills, so the WASM router can consider the 50/25/25 Alcor-style split.

### Verify

Run the existing WAX→WAXWETH quote through the router and confirm:
1. Pool 8568 (or 4941) is present in `poolsBuilt` diagnostics
2. Endpoint route seeding log fires with ≥1 route
3. The returned route is a multi-hop split (not 100% single route) and beats the HTTP fallback

Keep WAX→WAXWBTC verification passing (regression check).

### Notes

Not adding any social/app tokens to hubs — WAXWBTC is a legitimate base-asset intermediary on Alcor, matching the existing hub philosophy (WAX, USDT, USDC, WAXUSDC, WAXUSDT, LSW, LSWAX). No changes to grid/percent, HTTP fallback, or SDK selection logic.