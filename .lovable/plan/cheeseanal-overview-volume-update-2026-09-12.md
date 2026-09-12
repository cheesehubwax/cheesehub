# CHEESEAnal overview volume update

## Changes
- Rename the top analytics panel to **CHEESE Overview**.
- Add a sixth selectable **Total volume** box that sums USD volume across every tracked pair and every recorded daily volume sample inside the selected 48H, 7D, 30D, 90D, or ALL range.
- When selected, plot each recorded day's combined pair volume in USD, while treating snapshots without volume as missing rather than zero. Because volume is stored only once per UTC day, twice-daily liquidity snapshots will not be double-counted.
- Simplify each pool-history volume box, tooltip, and graph to show only USD volume and one line.
- Keep the existing snapshot data fields intact for compatibility; only the displayed volume metric changes.

## Verification
- Check the overview with existing pre-volume history and verify the new box shows an unavailable state until data exists.
- Verify the pool volume chart has one USD axis and one line.
- Run focused tests and confirm the preview build is clean.
