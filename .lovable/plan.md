# Fix the missing prices and supply numbers

## What went wrong

Your preview's own error log from a minute ago shows the cause:

```text
09:05:08 WAX endpoint https://wax.hivebp.io failed: Failed to fetch
09:05:13 WAX endpoint https://wax.hivebp.io failed: signal is aborted without reason
... (repeated for every single read)
```

The node health service reports `wax.hivebp.io` as the healthiest WAX node, so
yesterday's change moved it to the front of every list. From this sandbox it
answers fine in 0.4s — but from your browser it does not answer at all. It is
either blocked on your network or refusing that browser outright.

Because it sits first, every read on every page now starts by waiting the full
8-second timeout on a node that will never answer, and several reads give up
before they ever reach a working node. That is why prices, supply and the rest
come up blank. Nothing else about the change is wrong — the lead host is.

The deeper mistake: a monitoring service checks nodes from its own machines. A
node that is healthy for the monitor is not automatically reachable from a
visitor's browser, and nothing in the current code notices the difference.

## The fix

1. **Stop leading with an unproven node.** Put the nodes CHEESEHub has used
   reliably for months back at the front (greymass, eosusa, waxsweden,
   eosphere, cryptolions, alohaeos). Newly discovered nodes, including hivebp,
   move to the back of the list where they act as extra cover only.

2. **Learn from real failures in the visitor's browser.** Add a small memory of
   which nodes actually failed for *this* visitor: after two failures in a row a
   node is set aside for 10 minutes and tried last; one success clears it. So
   even if a node breaks only for some people, they wait for it once, not on
   every read of every page.

3. **Fail faster.** Drop the first-attempt wait from 8 seconds to 4 so an
   unreachable node costs a moment, not a blank page. Later attempts keep the
   longer wait for genuinely slow reads.

4. **Never let health ranking outrank proven nodes.** Live health keeps deciding
   the order *within* the proven group and keeps dropping dead nodes — it can no
   longer promote an untested node to first place.

## Verification

- Load the home page and CHEESEAnal in a browser and confirm price, market cap,
  TVL, supply, locked and nulled figures all fill in, with no repeated endpoint
  warnings in the console.
- Simulate an unreachable lead node in a test and confirm the reads still land
  and that node is skipped on the next call.
- Full test suite and build.

If prices are still blank for you after this, the next step is to have the site
read through a proxy rather than direct from your browser — but the logs point
squarely at the one bad lead node, so this should be it.

## Technical detail

- `src/lib/endpointHealth.ts`: reorder `STATIC_ENDPOINTS` (proven hosts first,
  hivebp/sentnl/eosdac/eosnation last); add `reportEndpointFailure(url)` /
  `reportEndpointSuccess(url)` with a `Map<string, {fails, until}>` quarantine
  (`QUARANTINE_FAILS = 2`, `QUARANTINE_MS = 10 * 60_000`) persisted in
  `sessionStorage`; `mergeEndpoints` pushes quarantined hosts to the tail
  instead of dropping them; health ranking applies only inside the vetted group.
- Wire `reportEndpointFailure` / `reportEndpointSuccess` into the per-endpoint
  catch/success paths of `fetchWithFallback.ts`, `waxRpcFallback.ts`,
  `hyperionHistory.ts`, `lpVenues.ts`, `airdropChain.ts`, `cheeseStats.ts`.
- First-attempt timeout: 4000ms, then the existing timeout for the remainder.
- Tests in `src/test/endpointHealth.test.ts` for quarantine ordering, expiry,
  success reset, and that a quarantined host is still tried last.
