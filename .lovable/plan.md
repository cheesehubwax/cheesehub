# Replace the placeholder banner with the WaxEDGE banner

## What changes

The yellow CHEESEFarm placeholder banner is kept, but demoted to a second
placeholder. The uploaded WaxEDGE banner (580x150, exact slot size) becomes
the first placeholder:

- When one shared slot's second half is unrented → the WaxEDGE banner fills it.
- When two shared slots are open side by side at the same time (position 1 and
  position 2 both have empty shared halves) → WaxEDGE fills the first empty
  slot, the old yellow CHEESEFarm banner fills the second, so the two empty
  slots never show the same image.

Paid banners and the rest of the banner system are untouched.

- Clicking the WaxEDGE banner opens **https://waxedge.app** and goes through
  the same external-link warning dialog paid external banners use. The yellow
  banner keeps its existing internal link to `/farm`.
- The empty-slot dashed state ("Slot N — Available") is unchanged.

## Implementation

1. **Asset**: copy the upload into the repo as a regular bundled image,
   `src/assets/waxedge-banner.jpg`, imported exactly like the existing
   `cheese_banner4.png`. A Lovable CDN asset pointer (`/__l5e/assets-v1/...`)
   cannot be used here: that URL is only served by Lovable hosting and the dev
   proxy, so the banner would be blank on the GitHub Pages deployment at
   `/cheesehub/`. A bundled import is rewritten by Vite to the correct
   `/cheesehub/` path at build time, so it works in the preview, on Lovable
   hosting, and on GitHub Pages.
2. **`src/components/bannerads/BannerDisplay.tsx`**:
   - Add an import for the new `.asset.json` pointer; use its `.url` as the
     WaxEDGE placeholder's `localSrc`.
   - In `BannerDisplay`'s slot loop, count placeholders as slots are processed
     in position order: the first unrented shared half gets WaxEDGE
     (`websiteUrl: "https://waxedge.app"`, alt "WaxEDGE Banner"), the second
     and any further ones get the existing yellow banner
     (`websiteUrl: "/farm"`, alt "CHEESEFarm Banner"). The count lives in the
     same `useMemo`, so it resets whenever the slot group changes.
   - Fix the `localSrc` render branch in `BannerLayer`: it currently renders a
     router `<Link to={...}>`, which cannot handle an external URL. Route the
     click through the existing `onAdClick` handler (role="link", keyboard
     support, same as the IPFS branch) so internal routes still navigate and
     external URLs get the `ExternalLinkWarning` dialog. Keep no "AD" badge on
     placeholders, matching today's behaviour.
3. **Cleanup**: none — `cheese_banner4.png` remains in use as the second
   placeholder.

## Verification

- Browser check on the homepage: the WaxEDGE banner renders in the placeholder
  half at 580x150, click opens the external-link warning, paid banners render
  as before.
- Typecheck + build + test suite.
