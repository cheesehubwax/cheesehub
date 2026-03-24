

## Drip Name Backup & Restore

Two small buttons added to the My Drips tab header (next to the Refresh button):

### How it works for the user

1. **Export** — click a download button, instantly saves a small JSON file (`drip-names-{account}.json`) to their device
2. **Import** — click an upload button, pick the JSON file, names are restored immediately

### Technical changes

**`src/components/drip/MyDrips.tsx`**
- Add two icon buttons (Download, Upload) next to the existing Refresh button
- Export: reads `localStorage` for the user's drip names via `getAllDripNames()`, creates a Blob, triggers a file download
- Import: opens a hidden `<input type="file">` accepting `.json`, parses the file, calls `setDripName()` for each entry, then refreshes the view

**`src/lib/dripNames.ts`**
- Add `importDripNames(account: string, names: Record<number, string>)` — bulk-writes names to localStorage

No new dependencies. No new pages. Just two small buttons.

