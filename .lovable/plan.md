

## Plan: Downgrade cheesebannad baseline to informational only

The `cheesebannad` contract's `wax_per_cheese_baseline` isn't actively used for payment gating, so it shouldn't trigger critical/warning status on the admin card.

### Changes

**`src/pages/Admin.tsx`**
- Remove the `bannadSeverity` variable and stop using it to set the cheesebannad card's `status` prop — just hardcode `status="ok"`
- Remove the `warn`/`critical` flags from the "Baseline Drift" row — show the deviation percentage as plain informational text
- Optionally add a small "(informational)" label next to the drift value

This is purely a display change — the deviation value still shows, it just won't colour the card red/yellow.

### Files changed
1. `src/pages/Admin.tsx` — remove severity-based styling for cheesebannad card

