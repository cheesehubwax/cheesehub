# Close the remaining CHEESECrypt network leaks

Goal: while on CHEESECrypt with a v1.6 Tor helper running, no request that names the account, and no request from the browser's own IP to WAX nodes, leaves the browser directly. If the helper is down, account-named reads are skipped (fail closed) instead of going to public nodes. Without a helper set up, today's behaviour stays.

## What changes for the user

- Opening or refreshing CHEESECrypt no longer checks the CHEESE balance or the Instant Messaging status on public nodes. Both go through the helper.
- The `/tip` balance check goes through the helper. If the helper is down, the tip box shows "balance unknown" and lets the user continue.
- Getting a transaction ready before signing (block info, required keys) goes through the helper, so signing no longer exposes the IP.
- The room curator, hidden-room and sponsor-budget checks go through the helper.
- Avatar Editor → "Wallet NFT" tab uses the helper for the NFT list and images. If the helper is down, it shows the usual "🧅 hidden" notice. Painter and file import stay local.
- The Privacy dialog offers helper v1.6 and explains the new coverage.

## Build order

1. Helper v1.6 (`public/downloads/cheesecrypt-tor-proxy-v1.6.mjs`, replacing v1.5)
   - Widen the chain read whitelist to every read-only path WharfKit uses: get_info, get_block, get_block_info, get_block_header_state, get_abi, get_raw_abi, get_raw_code_and_abi, get_required_keys, get_table_by_scope, get_currency_stats, plus the existing three.
   - Add an AtomicAssets list route, `/atomic/v1/assets?owner=…` with fixed allowed query keys, for the Avatar NFT tab.
   - Prep reads get a fresh isolation label each time and rotate upstreams. Broadcasts stay one attempt on a single node.
   - `/v2/helper` reports version 1.6 and adds the `prep` and `atomic-list` features.
2. Routing helper in `src/lib/cryptMediaProxy.ts`: `resolveChainReadRoute()` returns `tor(base)`, `blocked` or `public`, using the same probe and fail-closed rules as Respect. A pure `decideChainReadRoute()` gets unit tests.
3. A shared `cryptChainPost(path, body)` that goes to the helper or public nodes (via `resolveEndpoints`), or throws `blocked`.
4. Call sites:
   - `WaxContext` startup `refreshBalance()`: skip on the Crypt path, and refresh once when the user leaves Crypt.
   - `fetchInstantStatus`: use `cryptChainPost`. When blocked, the status shows "unknown" and the enable/revoke buttons still work.
   - `/tip` in `CheeseCrypt.tsx`: use the routed balance read.
   - `fetchSponsorBudget`, `fetchRoomCurators` and `fetchRoomHides`: use the routed read on Crypt. When blocked, keep the existing last-good cache.
   - `walletRpcFetch`: on the Crypt path, send prep reads to the helper when it is v1.6+. If an older helper is set, prep reads use public nodes and the Privacy dialog says so. A failed broadcast is never retried.
   - `AvatarEditor` Wallet NFT tab: routed list and media.
5. Tests: route decision, the prep-read path picking the helper, broadcast staying single-attempt, the blocked balance not falling back. Update the privacy text and the AGENTS rules in `src/lib` and `src/components/crypt`.

## Still outside our control (no code change)

- Anchor desktop's own node connection. The Privacy dialog will advise setting a proxy in Anchor or using a system-wide Tor/VPN.
- Node operators still see which accounts get queried through Tor. Caching and decoys already reduce this.

## Technical details

- Detection happens once per page session through the existing probe. Below v1.6, chain reads count as unsupported, so no fail-closed breakage on old helpers.
- Helper paths are validated with exact regexes. Bodies are capped at 16 KB, nothing is written to disk, and only loopback is accepted, as today.
- Legal note: this stays a local proxy for the user's own traffic. It is not a relay for others, so it adds no new liability.
