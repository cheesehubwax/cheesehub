Plan to fix the first-quote multiroute visual only:

1. Embed route visual metadata in the SDK quote
   - Extend each SDK split with the token path and pool fees already available while `computeAlcorTrade` builds the winning trade.
   - This avoids needing a second pool lookup just to display token symbols/fees.

2. Render embedded metadata first
   - Update `MultiRoutePanel` to use split-provided token path + fees immediately when present.
   - Keep the existing pool lookup only as a fallback for HTTP/API routes that do not include embedded visual metadata.

3. Remove the “blank until all pools load” failure mode
   - Only show the skeleton when a route truly lacks embedded metadata and the fallback pool details are still loading.
   - This prevents cooldown/rate-limit state from blocking the visual when the actual quote already contains everything needed.

4. Keep swap math and execution untouched
   - Do not change quote selection, output amounts, SDK routing, memos, slippage, transaction construction, retries, or cooldown logic.
   - This is strictly a display-data fix for the multiroute box.

Validation:
- Verify TypeScript passes.
- Use the preview to hard refresh, request the first quote, and confirm the multiroute row shows token icons/fees immediately instead of the blank skeleton.