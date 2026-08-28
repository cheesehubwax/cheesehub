# CHEESERam — Dual-Line Price Chart (CHEESE + WAX)

## Goal

Turn the single CHEESE-denominated RAM price sparkline into a two-line chart: the existing yellow CHEESE line plus a white WAX line, in the same panel. No second graph panel.

## Current state (confirmed)

- `src/hooks/useCheeseRam.ts` — `useRamPrice()` already stores both values per history point: `price` (WAX per byte) and `cheesePerKb` (CHEESE per KB). No hook changes needed for data, but points need a `waxPerKb` field for a clean dataKey.
- `src/components/ram/RamPricePanel.tsx` — renders one `<Area dataKey="cheesePerKb">` with the primary-color gradient; tooltip shows CHEESE / KB only; header shows the current CHEESE / KB value only.

## Changes

### 1. `src/hooks/useCheeseRam.ts`
- Add `waxPerKb: number` to `RamPricePoint` (derived as `price * 1024`).
- Populate `waxPerKb` in both the seeding branch and the append branch of the history effect.

### 2. `src/components/ram/RamPricePanel.tsx`
- Add a second `<Area dataKey="waxPerKb">` with a white stroke (`stroke="#FFFFFF"`) and no fill (or a faint white gradient at low opacity) so the two series stay visually distinct.
- Add a small legend next to the "Live RAM Price" title: yellow dot "CHEESE", white dot "WAX".
- Update the header value to show both rates, e.g. `1.9249 CHEESE | 0.0075 WAX per KB` (compact, mono font, white for the WAX part).
- Extend the tooltip to show both values for the hovered point.
- Because the two series have very different magnitudes (CHEESE per KB ≈ 2, WAX per KB ≈ 0.008), plot each on its own scale: give the WAX area a separate hidden `YAxis` with `yAxisId="wax"` and the same 0.1% domain buffer, so both lines undulate visibly instead of the WAX line flattening against the axis.

## Notes

- The flat-line appearance is expected: the RAM market price moves in tiny increments, so over a short session the line barely moves. The per-axis scaling above maximizes visible movement for both lines.
- No layout changes; the panel stays `max-w-lg` between the reserves row and the buy/sell tabs.

## Verification

- Build passes with no errors.
- Preview `/ram`: chart shows two lines (yellow + white), legend renders, tooltip shows both denominations, values update every 30s.
