# CHEESEAnal floating orb image

## Goal
Replace the borrowed `cheeseram.png` orb on the CHEESEAnal page (`/anal`) with a dedicated orb that uses the CHEESE token logo (round gold coin with holes) as the focal point, matching the style of the other dApp orbs.

## Image concept
- **Focal point:** the round gold CHEESE token coin, front and center, large and crisp.
- **Analytics theme:** a glowing rising line-chart / candlestick motif wrapped around or emerging behind the coin — holographic green/yellow chart line trending upward, subtle grid lines, small candlestick bars.
- **Style match:** same 3D glossy, slightly playful look as the existing orbs (cheeseram wedge, cheese lock, etc.), warm cheese-yellow palette with metallic accents.
- **Transparent background**, square canvas, centered subject — consistent with the other orb assets.
- Save as `src/assets/cheeseanal.png`.

## Code change
- `src/pages/CheeseAnal.tsx`: swap the import from `@/assets/cheeseram.png` to `@/assets/cheeseanal.png` (variable rename `cheeseOrb` → `cheeseAnalOrb`, alt text stays "CHEESEAnal"). No layout changes.

## Verification
- View the generated image to confirm the token logo is the clear focal point.
- Typecheck + build pass.
- Playwright: `/anal` hero shows the new orb.
