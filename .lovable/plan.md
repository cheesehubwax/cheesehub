# CHEESEAnal overview volume update

## Changes
- Rename the top analytics panel to **CHEESE Overview**.
- Add a sixth selectable **24h volume** box that totals recorded USD volume across all tracked pairs.
- Plot that combined USD volume in the overview when selected, while treating snapshots without volume as missing rather than zero.
- Simplify each pool-history volume box, tooltip, and graph to show only USD volume and one line.
- Keep the existing snapshot data fields intact for compatibility; only the displayed volume metric changes.

## Verification
- Check the overview with existing pre-volume history and verify the new box shows an unavailable state until data exists.
- Verify the pool volume chart has one USD axis and one line.
- Run focused tests and confirm the preview build is clean.
