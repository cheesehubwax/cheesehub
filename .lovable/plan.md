## What's happening

Every row in the token selector renders an `<img src="https://wax.alcor.exchange/api/v2/tokens/{ticker}-{contract}/logo">`. For tokens Alcor doesn't have a logo file for, the request 404s, `onError` fires, and we swap in the letter-avatar fallback. That's the flood of red 404s you see.

It's not "spamming" Alcor in a harmful way — each missing logo is requested at most once per token per page load, and the browser caches the 404 for the session so scrolling/reopening doesn't re-hit. But two real problems remain:

1. **Console noise.** Every scroll into new rows produces new 404s. Browsers won't let us silence `<img>` 404s from JS, but we can stop *issuing* the request for tokens we already know are missing.
2. **Wasted requests on first open.** ~hundreds of tokens = ~hundreds of GETs, most of which will 404. `<img loading="lazy">` isn't set, so every row fetches immediately even before the user scrolls to it.

## Plan

Two small, surgical changes in the token-selector rendering path — no logic changes elsewhere.

### 1. Persist a "known-missing logo" set across the session

Add a tiny module (e.g. `src/lib/tokenLogoMisses.ts`) that:

- Holds an in-memory `Set<string>` of `contract:ticker` keys whose logo already 404'd.
- Hydrates from `sessionStorage` on load, persists on write.
- Exposes `hasMissingLogo(contract, ticker)` and `markMissingLogo(contract, ticker)`.

Then in the two logo renderers:

- `src/components/swap/TokenSelector.tsx` (inner `TokenLogo`)
- `src/components/TokenLogo.tsx`

Before rendering the `<img>`, check `hasMissingLogo(...)`. If true, render the letter-avatar directly and skip the network request entirely. In the existing `onError` handler, additionally call `markMissingLogo(...)`.

Effect: first session-load still probes each token once (unavoidable — we don't know which are missing), but every subsequent open of the selector renders instantly with zero 404s for tokens already known bad.

### 2. Lazy-load logos so offscreen rows don't fetch

Add `loading="lazy"` and `decoding="async"` to both `<img>` tags. Combined with the existing `ScrollArea` (`h-[320px]`), this means only the ~10 visible rows fetch on open; the rest fetch as the user scrolls. On sessions where the user only wants a popular token, we avoid hundreds of speculative requests.

### Files touched

- `src/lib/tokenLogoMisses.ts` — new, ~30 lines
- `src/components/swap/TokenSelector.tsx` — guard + `loading="lazy"` on the inner `TokenLogo`
- `src/components/TokenLogo.tsx` — guard + `loading="lazy"`

### Explicitly not doing

- No pre-flight HEAD probe (would double requests on first open).
- No change to `tokenLogos.ts` cache or Alcor API calls.
- No change to swap/quote logic.

### Validation

- Open token selector cold → 404s appear once for missing-logo tokens (unavoidable), letter avatars render.
- Close and reopen → no new 404s for those same tokens; letter avatars render immediately.
- Scroll: previously-offscreen rows fetch their logo only when scrolled into view.
- Popular-token chips (WAX, CHEESE, etc.) still render logos as before.