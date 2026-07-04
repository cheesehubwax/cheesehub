Yes — based on the console and current code, we are very likely overwhelming Alcor from the browser.

What changed:
- The working 85/15 split version used a smaller candidate pool set and completed a swap.
- The next routing update removed the hub allowlist and expanded routing to the full graph.
- Then we added background prefetching, but the live route query still fetches ticks too.
- Result: the widget can issue dozens of `/swap/pools/:id/ticks` requests, plus `/swap/pools`, plus `/swapRouter/getRoute` fallback, often at the same time.
- Alcor starts returning 502s; because those 502 responses do not include browser CORS headers, the browser reports them as CORS failures too.

Plan to step back safely:

1. Remove background tick prefetching
   - Remove the `prefetchAlcorRouterData` mount/interval call from the swap widget.
   - This immediately stops the app from fetching ticks before the user even has a quote.

2. Restore the last known working route load profile
   - Put routing back to a small, controlled candidate set similar to the successful 85/15 split version.
   - Keep SDK split routing enabled, but stop full-graph tick fanout from running on every quote.

3. Add a narrow CHEESE-specific route expansion instead of full-graph expansion
   - For WAX → CHEESE, include the exact additional intermediate pools needed to discover Alcor’s 3-way route.
   - Do not scan every possible 3-hop path across the whole Alcor graph.
   - This aims for Alcor parity without API spam.

4. Reduce hot-path tick concurrency and request volume
   - Lower tick fetch concurrency from 8 to 2–3.
   - Add a hard candidate cap that includes direct pools first, known high-liquidity hub pools second, and only a tiny number of extra CHEESE-relevant pools.

5. Stop retry loops from amplifying failures
   - If both SDK routing and HTTP fallback fail once with a network/502-style failure, show `Route unavailable — retry` instead of retrying up to 6 times.
   - Manual retry remains available.

6. Fix the unrelated balance warning
   - Update the disabled balance cache query so React Query no longer logs `No queryFn was passed`.

Expected result:
- The swap should work again like the successful 85/15 split version.
- Alcor request volume drops sharply.
- We can then compare WAX → CHEESE again and add only the missing route/pool needed for the 3-way split, instead of hammering the full graph.