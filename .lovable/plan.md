# Fix the CHEESEAnal overview volume line

## Change
- When **Total volume** is selected, give the large overview chart only the snapshots that contain a recorded volume value.
- Keep the complete snapshot series for CHEESE price, liquidity, CHEESE, providers, and positions.
- Preserve missing volume as unavailable rather than converting it to zero, while connecting valid daily volume points into one line.

## Verification
- Open `/anal`, select **Total volume**, and confirm recorded points are joined by a line.
- Confirm the other five overview metrics still use the full twice-daily history.
- Run focused checks and confirm the preview build is clean.
