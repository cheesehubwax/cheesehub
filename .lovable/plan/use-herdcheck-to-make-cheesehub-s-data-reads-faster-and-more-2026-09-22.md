# Use HerdCheck to make CHEESEHub's data reads faster and more reliable

Yes — that site is genuinely useful to us, and it already explains part of the slowness you've noticed.

## What I confirmed against it

HerdCheck monitors 126 WAX endpoints and publishes a free, machine-readable list that any website can read directly (no key, no sign-up, updated every few seconds). Checking our own hardcoded lists against it right now:

- `wax.pink.gg` — **down, 0% uptime**. It sits 4th in our main data list and in our balance list, so every read that gets that far waits for it to time out.
- `wax.blokcrafters.io` — **down, 0% uptime**. Also still in our lists.
- `wax.eosusa.io` — reported healthy this minute but only **41% uptime** over the monitoring window: our most-used first choice is the flakiest one we have.
- `eosphere`, `waxsweden`, `cryptolions`, `greymass` — currently "degraded" for general reads, though their history service is healthy.
- Good nodes we never use at all: `hivebp` (100%), `alohaeos` (100%), `hyperion7.sentnl.io`, `eosdac`, `eosrio`, `detroitledger`, `eosnation`, `blacklusion`.

So today we queue up dead nodes, lead with an unreliable one, and ignore several perfectly healthy ones. That matches "history and a few API things have been slow or buggy".

## What to build

**1. A shared health-aware endpoint resolver**

One new module that asks HerdCheck which nodes are healthy for the job we're about to do, and hands back an ordered list:

- Separate lists per job type: general chain reads, transaction history, balances, and NFT reads.
- Ordered best-uptime-first, dead and degraded nodes dropped.
- Answer cached in memory for 5 minutes, so it costs one small request per session, and the whole thing is skipped if HerdCheck itself is unreachable.
- Our current hardcoded lists stay as the built-in fallback, minus the two dead nodes, so nothing depends on a third party being up.

**2. Wire it into every place we read the chain**

Our chain readers, the history reader, balances, NFT reads, the analytics/leaderboard readers and the swap/LP readers all get their endpoint order from the resolver instead of a frozen array.

**3. Faster history reads**

History is the slowest part today because we ask three fixed providers and wait. With a health-filtered list we ask the healthiest providers instead, and drop any provider HerdCheck reports as down before we spend a timeout on it. We keep the union-of-providers behaviour that protects us from a provider returning a partial index.

**4. A node health panel in the admin dashboard**

A small read-only card listing each endpoint we rely on, its current status and uptime, so you can see at a glance when a provider is dragging — plus a link to HerdCheck.

**5. Nightly background jobs**

Our GitHub workflows (snapshots, RAM prices, daily power-up) get the same treatment, so a dead node can't cost a run its time budget.

## Technical notes

- Source: `GET https://herdcheck.blocdraig.com/api/v1/wax/endpoints?feature=<f>&status=up`, features `chain-api`, `hyperion-v2`, `history-v1`, `atomic-assets-api`. Verified `access-control-allow-origin: *` and `cache-control: public, max-age=5`, so it is safe to call from the browser.
- New `src/lib/endpointHealth.ts`: `resolveEndpoints(feature)` returns `string[]`; in-flight promise de-duped, 5-minute cache, hard 4s timeout, falls back to the static list on any failure or empty response. Never throws.
- Consumers updated: `waxRpcFallback.ts` (`WAX_RPC_ENDPOINTS`, `HYPERION_ENDPOINTS`), `hyperionHistory.ts` (`DEFAULT_HYPERION_ENDPOINTS`), `services/atomicApi.ts`, `lpVenues.ts`, `cheeseStats.ts`, `cheeseRam.ts`, `cheeseNullBreakdown.ts`, `fetchLeaderboard.ts`, `fetchPowerupLeaderboard.ts`, `airdropChain.ts`, `farmClaimHistory.ts`, `dao.ts`, plus `scripts/lp-history`, `scripts/ram-price-history`, `scripts/daily-powerup`.
- Static lists pruned: remove `wax.pink.gg` and `wax.blokcrafters.io`; add `wax.hivebp.io`, `api.wax.alohaeos.com`, `wax.api.eosnation.io`, `hyperion7.sentnl.io`, `wax.eosdac.io`.
- Admin card: `src/components/admin/NodeHealthPanel.tsx` + a react-query hook, 5-minute stale time, no writes.
- Unit tests for the resolver: healthy ordering, dead-node filtering, cache reuse, fallback when HerdCheck fails.

## Out of scope

Signing transactions keeps using Greymass Fuel and the existing wallet plumbing — this changes only where we *read* data from.
