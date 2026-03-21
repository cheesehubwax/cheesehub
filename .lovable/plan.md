

## Add Banner Slot Creator to Admin Dashboard

### Summary
Add an "Add Banner Slots" card to the `/admin` page that lets admins pick a date range, set positions per day, preview the timestamps, and call the `initbannerad` action on `cheesebannad`.

### New File: `src/components/admin/AddBannerSlotsCard.tsx`
- Date range picker (start date + end date) using Shadcn Calendar in Popovers
- "Positions per day" number input (default 2)
- Preview table: each date → its 14:00 UTC Unix timestamp × position count
- "Create Slots" button that batches one `initbannerad` action per day:
  ```json
  {
    "account": "cheesebannad",
    "name": "initbannerad",
    "authorization": [{ "actor": accountName, "permission": "active" }],
    "data": { "time": <14:00 UTC timestamp>, "number_of_slots": <positions> }
  }
  ```
- Uses `useWaxTransaction` for execution with modal cleanup
- Gets session/account from `useWax` context
- Styled consistently with existing admin cards (dark border, icon, Megaphone icon)

### Modified: `src/pages/Admin.tsx`
- Import and render `AddBannerSlotsCard` below the existing contract cards grid (only visible to authenticated admins, which is already gated)

### Timestamp Logic
- For each day in range: `new Date(\`\${yyyy}-\${mm}-\${dd}T14:00:00Z\`).getTime() / 1000`
- Preview table shows human-readable date + calculated Unix timestamp so admin can verify before submitting

