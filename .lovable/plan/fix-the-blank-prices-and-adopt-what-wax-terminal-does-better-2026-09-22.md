# Fix the blank prices — and adopt what WAX Terminal does better

## What went wrong

Your preview's own error log, from 09:05 this morning:

```text
09:05:08 WAX endpoint https://wax.hivebp.io failed: Failed to fetch
09:05:13 WAX endpoint https://wax.hivebp.io failed: signal is aborted without reason
... repeated for read after read
```

The node-health service ranks `wax.hivebp.io` as the single healthiest WAX node,
so yesterday's change put it first in every list. From this sandbox it answers in
0.4 seconds. From your browser it never answers at all.

Because it leads, every read on every page now burns the full 8-second timeout
on a node that will never reply, and many reads give up before reaching a good
node. Hence blank price, supply, market cap and TVL.

The real mistake: a monitoring service checks nodes from its own machines. A node
healthy for the monitor is not necessarily reachable from a visitor's browser,
and nothing in the code noticed the difference.

## What your friend's terminal does better

I read the WAX Terminal source. It is fast for reasons worth copying, and one of
its code comments describes exactly the trap we just fell into:

1. **Hedged reads.** If the first node hasn't answered in 2.2 seconds, a second
   node is tried alongside it and the first answer home wins. A dead node costs
   two seconds, never a blank page. (Their note: waxsweden was timing out at 20s
   while greymass answered in 60ms.)
2. **Benching.** A node that times out is benched 25s, a rate-limited one 30s,
   any other error 15s, and reads rotate round-robin through the rest.
3. **No CORS preflight.** They send chain reads as `text/plain` rather than
   `application/json`, because a JSON content type makes the browser send an
   OPTIONS preflight first — and greymass answers that preflight with a 400,
   which the browser reports as a CORS failure. I confirmed the 400 myself
   today. Every one of our chain reads currently pays this cost.
4. **A roster of six proven hosts** — eosusa, waxsweden, greymass, cryptolions,
   eosdac, alohaeos. Notably not hivebp.
5. **Draw first, refresh behind.** Cached numbers paint immediately, the fresh
   sweep runs behind the reader and repaints, and the header says how old the
   numbers are and lets you click to refresh.
6. **Six reads in flight at most** — enough to be fast, not enough to look like
   an attack and get rate-limited.

## The fix

**Step 1 — unblock the data (this is what restores your prices)**

- Put proven nodes back in front: eosusa, waxsweden, greymass, cryptolions,
  eosdac, alohaeos. hivebp and other newly discovered hosts move to the back as
  extra cover only. Live health still orders within that group and still drops
  dead nodes — it can no longer promote an untested node to first place.
- Send chain reads as `text/plain` so no CORS preflight is issued at all.
- Cut the first-attempt wait from 8 seconds to 9-second hard cap with hedging
  (below) doing the real work.

**Step 2 — hedging and benching, so one bad node can never do this again**

- Hedged reads: second node starts after 2.2s, first answer wins, up to 4
  attempts.
- Bench a node that fails: 25s on timeout/network error, 30s on 420/429, 15s on
  any other error; benched nodes are skipped while rotating and come back
  automatically.
- Cap concurrent chain reads at six.

**Step 3 — paint before the chain answers**

- Keep the last good numbers for the headline stats (price, supply, locked,
  nulled, TVL) in the browser's own storage, show them immediately on load with
  their age, and repaint when the fresh read lands.

## Verification

- Home page and CHEESEAnal in a browser: every stat fills in, no repeated
  endpoint warnings in the console.
- A test where the lead node never answers: reads still land within ~3 seconds
  and that node is skipped on the next call.
- A test that chain requests carry no JSON content type (no preflight).
- Full test suite and build.

## Technical detail

- `src/lib/endpointHealth.ts`: reorder `STATIC_ENDPOINTS` (proven hosts first,
  hivebp/sentnl/eosnation last); add `benchEndpoint(url, ms)` /
  `isBenched(url)` with a module `Map<string, number>`; `mergeEndpoints` sends
  benched hosts to the tail rather than dropping them; health ranking applies
  only inside the vetted group.
- New `src/lib/chainRequest.ts`: `hedgedPost(path, body, {tries: 4, hedgeMs:
  2200, timeoutMs: 9000})` — round-robin cursor over `resolveEndpoints`,
  `content-type: text/plain;charset=UTF-8`, benching on failure per the rules
  above, first fulfilled response wins.
- Route `fetchTableRows` / `waxRpcCall` / `fetchAllTokenBalances`
  (`waxRpcFallback.ts`), `cheeseStats.ts` and `cheeseNullBreakdown.ts` chain
  reads through `hedgedPost`; leave Hyperion history on its existing union
  reader but give it the same benching and `mapLimit(6)` bound.
- SWR cache: small `src/lib/statCache.ts` (localStorage, versioned key, 24h max
  age) used by the home stat hooks as `placeholderData`, with the existing
  react-query refresh repainting on arrival.
- Tests in `src/test/endpointHealth.test.ts` and a new
  `src/test/chainRequest.test.ts` (hedge fires, bench skips, text/plain header,
  first-answer-wins).

Also to record in `roadmap.md`: "Adopt WAX Terminal read patterns (hedging,
benching, no preflight, draw-then-refresh)".
