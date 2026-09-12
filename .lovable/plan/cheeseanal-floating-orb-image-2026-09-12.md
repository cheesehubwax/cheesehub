# CHEESEAnal floating orb image

## Goal
Replace the borrowed `cheeseram.png` orb on the CHEESEAnal page (`/anal`) with a dedicated orb that uses the CHEESE token logo as the focal point, matching the style of the other dApp orbs.

## Image concept
- **Focal point:** the uploaded CHEESE token logo (yellow cheese wedge/pyramid with holes — `user-uploads://CHEESE_LOGO-4.png`), front and center, large and crisp. The edit must preserve this exact logo.
- **Analytics theme:** a glowing rising line-chart motif integrated with the logo — e.g. a bright upward-trending chart line (green/yellow) wrapping around or rising behind the wedge, subtle candlestick bars and grid lines, a soft holographic glow. The logo remains unmistakably the hero of the image.
- **Style match:** same 3D glossy, playful look as the existing orbs (cheeseram wedge, cheese lock, etc.), warm cheese-yellow palette with subtle metallic/glow accents.
- **Transparent background**, square canvas, centered subject — consistent with the other orb assets.
- Generated via image edit using the uploaded logo as the source image, saved as `src/assets/cheeseanal.png`.

## Code change
- `src/pages/CheeseAnal.tsx`: swap the import from `@/assets/cheeseram.png` to `@/assets/cheeseanal.png` (variable rename `cheeseOrb` → `cheeseAnalOrb`, alt text stays "CHEESEAnal"). No layout changes.

## Verification
- View the generated image to confirm the token logo is the clear focal point and the chart motif reads as analytics.
- Typecheck + build pass.
- Playwright: `/anal` hero shows the new orb.
