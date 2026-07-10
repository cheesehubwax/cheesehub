Plan to fix the crash without intentionally hiding better splits:

1. Add an Alcor tick request scheduler
   - Route every `/swap/pools/:id/ticks` fetch through one shared client-side queue.
   - Limit tick concurrency much lower than today and add a small spacing delay between tick requests.
   - On 429, mark global cooldown, retry that pool with exponential backoff once or twice, then negative-cache it longer so repeated quote attempts do not hammer the same pool again.

2. Make route discovery staged instead of all-at-once
   - Keep broad pool coverage, but fetch ticks in priority batches:
     - direct pools first
     - endpoint/hub pools next
     - remaining candidate pools last
   - After each batch, build routes from the pools already available and keep the best trade found so far.
   - Stop early when later batches cannot safely complete due to rate limits instead of failing the whole quote.

3. Make SDK route failures non-crashing
   - If tick fetching is rate-limited but a valid partial SDK route exists, return it only if it beats HTTP.
   - If SDK cannot complete and HTTP has a valid route, return HTTP as a safe fallback instead of throwing until React Query exhausts retries.
   - Keep diagnostics so logs show whether the displayed quote is complete, partial, HTTP fallback, or rate-limited.

4. Preserve “best result wins” behavior
   - Keep the fine 1% split search and coarse 5% comparison.
   - Do not block 2% or other small split improvements.
   - Only add splits when the resulting total quote beats the competing route/fallback.

5. Improve logging for this exact issue
   - Log selected pool count, ticks requested, ticks succeeded, 429 count, queue/backoff state, best partial quote, and final selected quote source.
   - This will make it clear whether a quote is worse because Alcor rate-limited tick data or because the optimizer genuinely selected it.

Technical details:
- Primary files: `src/lib/alcorRouter.ts`, with a small fallback-selection adjustment in `src/hooks/useSwapRoute.ts`.
- The main cause is the current bounded concurrency still firing many tick requests quickly across up to ~96+ pools, which Alcor rate-limits. The fix is to throttle and stage tick fetches rather than retrying the whole quote loop aggressively.