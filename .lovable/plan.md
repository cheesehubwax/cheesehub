# Restore blockchain history and Null by Contract

## Goal
Restore all affected history displays immediately while retaining protection against incomplete blockchain-history providers.

## Changes
1. **Make the shared history reader fail fast**
   - Apply one total time budget per provider, rather than restarting the timeout for every page.
   - Remove currently unhealthy providers from the default foreground set and retain multiple verified working providers.
   - Return the deduplicated results from successful providers when others fail or time out.
   - Throw a clear error only when every provider fails; never silently convert a total outage into an empty history.

2. **Reduce Null by Contract to a small number of reads**
   - Replace the current per-contract, per-period request fan-out with broad history reads fetched once and grouped locally.
   - Derive lifetime, 24-hour, 7-day, and 30-day values from those shared records.
   - Preserve authoritative on-chain counters for contracts that expose them.
   - Allow individual contract failures to produce a partial-data warning instead of blocking the entire table.

3. **Harden every affected history screen**
   - Update CHEESEDrop, CHEESEAds, CHEESEFarm, and CHEESEDao consumers to distinguish “no records” from “all sources failed.”
   - Keep deduplication and newest-first ordering.
   - Preserve all transaction and contract behavior; this work only changes read-only history loading.

4. **Verify the recovery**
   - Check types and the production build.
   - Open the homepage contract breakdown and each affected history view in the running preview.
   - Confirm records render, loading states finish, duplicate rows are absent, partial-source notices appear only when warranted, and no browser/runtime errors remain.

## Technical details
The confirmed regression is request amplification combined with per-page timeouts. The contract breakdown currently starts roughly 25 history unions, each across five providers; one provider returns HTTP 503 and another exceeds the timeout. Because each union waits for every provider and can paginate repeatedly, the page remains pending despite healthy providers already returning data. The correction will use bounded provider-level deadlines, a healthy foreground provider set, aggregated queries, and explicit outage handling.
