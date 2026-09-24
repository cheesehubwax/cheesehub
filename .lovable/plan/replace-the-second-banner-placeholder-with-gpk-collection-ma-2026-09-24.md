# Replace the second banner placeholder with GPK Collection Manager

## What changes

- Keep **WaxEDGE** as the first placeholder shown when a shared banner half is unrented.
- Replace the old yellow CHEESEFarm second placeholder with the uploaded **Unofficial GPK Collection Manager** banner.
- When both shared slots need placeholders at the same time, WaxEDGE appears first and GPK appears second.
- Stretch the supplied 3:1 artwork to the banner slot’s exact **580×150** dimensions, as requested.
- Clicking the GPK banner opens **https://gpkonwax.github.io/collection-manager/** through CHEESEHub’s existing external-link warning.
- Paid banners and available-slot displays remain unchanged.

## Implementation

1. Prepare the uploaded image as a 580×150 bundled image in the project. Keep it bundled rather than using a Lovable-only asset URL so Vite gives it the correct `/cheesehub/` path on GitHub Pages.
2. Update the placeholder selection in `BannerDisplay`:
   - first placeholder: WaxEDGE;
   - second and any later placeholder: GPK Collection Manager;
   - remove the old yellow CHEESEFarm image from placeholder rotation.
3. Give the GPK image descriptive alternative text and its supplied destination URL. Reuse the existing click handling so the external-site warning, keyboard access, and safe new-tab behavior remain consistent.

## Verification

- Confirm a single open shared half shows WaxEDGE.
- Confirm two simultaneous open shared halves show WaxEDGE first and GPK second.
- Confirm the GPK artwork fills 580×150 without empty side space.
- Confirm clicking GPK displays the warning and Continue opens the supplied address.
- Confirm paid ads and empty full-slot displays are unaffected.
- Run the relevant tests and production build, then confirm the built GPK image URL is prefixed for `/cheesehub/` and therefore works on GitHub Pages.
