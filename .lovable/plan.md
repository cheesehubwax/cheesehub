## Fix: Internal CHEESEHub banner ads should not show "leaving" warning

### Problem
`BannerDisplay.tsx` treats every IPFS-banner click as external and opens `ExternalLinkWarning`. When an advertiser sets the banner's website URL to a CHEESEHub page (e.g. `https://cheesehub.../dao` or the published domain pointing at `/dao`), users see a warning that they're leaving CHEESEHub for CHEESEHub.

### Fix
In `src/components/bannerads/BannerDisplay.tsx`, detect internal URLs in `handleAdClick` and route via React Router instead of opening the external-link warning.

Logic:
1. Sanitize the URL (existing `sanitizeUrl`).
2. Parse it. If hostname matches `window.location.hostname` (covers preview, custom domain, and any host the app is currently served from), treat as internal:
   - Take the `pathname + search + hash` portion.
   - Strip the app's `BASE_URL` prefix if present (so GitHub Pages base path works).
   - Use `useNavigate()` to push the internal route — no warning dialog, no new tab.
3. Otherwise, fall back to the existing `setWarningUrl(...)` flow.

Also handle relative URLs (already starts with `/`) — route internally directly without opening the warning. Currently relative URLs get rejected by `sanitizeUrl` to `#`, which is fine, but the placeholder banner already uses `<Link>` so this only affects renter-supplied URLs that happen to be relative; we'll skip the warning for those too if encountered.

### Files changed
- `src/components/bannerads/BannerDisplay.tsx` — add `useNavigate`, update `handleAdClick` to branch on same-origin vs external.

No other components need changes; `ExternalLinkWarning` stays as-is for true external links.