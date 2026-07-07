## Bug

`src/components/swap/SwapTokenInput.tsx` holds `imgError` in local state but never resets it when the selected token changes. When the "You receive" side auto-fills a token whose Alcor logo 404s (or when tokens are flipped/switched), the failed state carries over and the panel keeps rendering the fallback tile instead of trying the new token's logo.

The `<img>` element also isn't keyed to the token, so React reuses the same DOM node across token changes — a browser that has already cached the failed request won't re-issue it, cementing the placeholder.

## Fix (one file)

`src/components/swap/SwapTokenInput.tsx`:

1. Add `useEffect(() => setImgError(false), [token?.contract, token?.ticker])` so each token gets a fresh attempt.
2. Add `key={`${token.contract}-${token.ticker}`}` on the `<img>` so React remounts it on token change and the browser re-requests the logo.

No changes to logic, styling, or any other file. The existing letter-circle fallback (yellow `bg-cheese/20` with the ticker's first letter) is kept for tokens Alcor genuinely doesn't have a logo for.

## Verification

- Load `/`, open CheeseSwap, set input to WAX, receive to CHEESE → both logos render.
- Change receive to a token Alcor has no logo for (e.g. WAXCASH) → letter fallback shows immediately.
- Change receive back to CHEESE → real logo renders (previously stayed on fallback).
- Flip tokens → both sides show correct logos.

Approve and I'll apply the two-line change and verify in the preview.
