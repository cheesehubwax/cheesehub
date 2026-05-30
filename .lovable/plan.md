## Quick-select duration buttons for farm expiration

Add a row of preset duration buttons (**30d / 60d / 90d / 180d / 360d**) above the calendar in both farm expiration dialogs. Clicking a preset sets the calendar's selected date to `baseDate + N days`.

### Files

**`src/components/farm/OpenFarmDialog.tsx`**
- Base date = `new Date()` (today).
- Render a `flex flex-wrap gap-2` row of 5 outline `Button size="sm"` presets directly above the `<Calendar>`.
- onClick sets `expirationDate` to `new Date(Date.now() + N * 86400 * 1000)`.
- Highlight active preset (`variant="default"` when the selected date matches that preset within the same day, else `variant="outline"`).

**`src/components/farm/ExtendFarmDialog.tsx`**
- Base date = `currentExpDate` (the farm's existing expiration), so presets extend *from* current expiration — matches the existing default behavior on line 23.
- Same 5 presets, same styling and active-state logic.
- Keep the `disabled={(date) => date <= currentExpDate}` guard on the Calendar.

### Shared shape

```tsx
const PRESETS = [30, 60, 90, 180, 360];
// Render:
<div className="flex flex-wrap gap-2 mt-2">
  {PRESETS.map(d => (
    <Button key={d} type="button" size="sm"
      variant={isActive(d) ? "default" : "outline"}
      onClick={() => setDate(addDays(base, d))}>
      {d}d
    </Button>
  ))}
</div>
```

No changes to `farm.ts`, transaction logic, or other dialogs.
