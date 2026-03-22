

## Add "Delete Drop" functionality to My Drops

### Summary
Add a delete button to each drop card in the My Drops section. Clicking it shows a confirmation dialog, then executes two contract actions: `nft.hive::boost` + `nfthivedrops::erasedrop`, matching the on-chain transaction pattern.

### Changes

**1. `src/lib/drops.ts`** — Add `buildEraseDropActions` helper
- Two actions: `nft.hive::boost` (booster: account) + `nfthivedrops::erasedrop` (authorized_account: account, drop_id: dropId)

**2. New file: `src/components/drops/DeleteDropDialog.tsx`**
- Confirmation dialog (AlertDialog) that warns the action is irreversible
- Shows the drop name and ID
- On confirm: calls `useWaxTransaction` with `buildEraseDropActions`, then invalidates the `userDrops` query to refresh the list
- Props: `dropId: number`, `dropName: string`, `open: boolean`, `onOpenChange`

**3. `src/components/drops/MyDrops.tsx`**
- Import `DeleteDropDialog` and `Trash2` icon
- Add state for selected drop to delete
- Add a red trash icon button to each drop card (bottom of CardContent, next to the NFT Hive link)
- Render `DeleteDropDialog` at component level, controlled by state

### Technical details
- Contract: `nfthivedrops`, action: `erasedrop`, params: `{ authorized_account, drop_id }`
- Preceded by `nft.hive::boost` action (same pattern as drop creation)
- After successful deletion, invalidate `['userDrops', accountName]` query

### Files changed
1. `src/lib/drops.ts` — new `buildEraseDropActions` function
2. `src/components/drops/DeleteDropDialog.tsx` — new confirmation dialog
3. `src/components/drops/MyDrops.tsx` — add delete button + dialog integration

