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

1. **Asset**: upload the uploaded image via `lovable-assets` from
   `/mnt/user-uploads/waxedge.jpg` → `src/assets/waxedge-banner.jpg.asset.json`
   (CDN pointer; no binary left in the repo).
2. **`src/components/bannerads/BannerDisplay.tsx`**:
   - Replace the `cheeseBanner4` import with the new `.asset.json` pointer;
     use its `.url` as the placeholder's `localSrc`.
   - In `extractBannersForSlot`, the placeholder entry becomes
     `websiteUrl: "https://waxedge.app"` (was `/farm`), alt text
     "WaxEDGE Banner".
   - Fix the `localSrc` render branch in `BannerLayer`: it currently renders a
     router `<Link to={...}>`, which cannot handle an external URL. Route the
     click through the existing `onAdClick` handler (role="link", keyboard
     support, same as the IPFS branch) so internal routes still navigate and
     external URLs get the `ExternalLinkWarning` dialog. Keep no "AD" badge on
     the placeholder, matching today's behaviour.
3. **Cleanup**: `src/assets/cheese_banner4.png` becomes unused — delete it
   (it is only referenced in BannerDisplay.tsx).

## Verification

- Browser check on the homepage: the WaxEDGE banner renders in the placeholder
  half at 580x150, click opens the external-link warning, paid banners render
  as before.
- Typecheck + build + test suite.
