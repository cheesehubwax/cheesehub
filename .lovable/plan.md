

## Show Edit button to slot owners (with 48hr cutoff)

### Changes

**File: `src/components/bannerads/SlotCalendar.tsx`**

Update the Edit button visibility logic (line 229):

- **Slot owners** (primary `slot.user` or `slot.sharedUser` matches `accountName`) can see Edit **only if** the slot's start time is more than 48 hours away (reuse existing `isWithinBuffer` with `MIN_RENT_BUFFER_HOURS`)
- **Admins** keep unrestricted Edit access (no time limit)
- Condition: `slot.isOnChain && !slot.suspended && (isAdmin || (isOwnerOrShared && isWithinBuffer(slot.time, MIN_RENT_BUFFER_HOURS)))`

**File: `src/components/bannerads/EditBannerDialog.tsx`**

Fix the `user` field in the transaction data (line 35):

- For primary edit (`editadbanner`): send `user: slot.user` instead of `session.actor.toString()`
- For shared edit (`editsharedad`): send `user: slot.sharedUser`
- This lets both owners (signing as themselves) and admins (signing with admin auth on behalf of the owner) submit the transaction correctly

### Summary
- 2 files, minimal changes
- Owners get a 48hr edit window, then it locks for admin review
- Admins retain full edit access at all times

