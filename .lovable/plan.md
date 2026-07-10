## Plan

Fix the hard-refresh first quote so it never displays the bad partial multiroute.

1. **Stop accepting partial tick sets**
   - Change the SDK route builder so any failed tick fetch makes the quote attempt fail/retry before a route can be returned.
   - This prevents a 47/56-pool partial route from being displayed as if it were final.

2. **Reduce first-load request pressure**
   - Lower tick-fetch concurrency for the actual quote and prewarm path so Alcor is less likely to return 429s on a cold hard refresh.
   - Keep the retry loop, but avoid creating the 429 storm that causes the bad first route.

3. **Do not fall back to HTTP while SDK is incomplete**
   - Treat “incomplete SDK route” as transient for the hook retry classifier.
   - Keep the swap panel in loading/retrying state instead of showing route unavailable or a worse fallback route.

4. **Verify with the user’s scenario**
   - Hard refresh, enter the same pair/amount, and confirm the first visible multiroute is the later correct split rather than the initial bad one.