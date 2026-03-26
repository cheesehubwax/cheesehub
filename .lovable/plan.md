

## Fix: Shared slot primary banner not displaying

### Problem
When a slot is rented as "shared" (rental_type=1) and only the primary renter has joined (no shared_user yet), `isAvailable` is set to `true`. The `extractActiveBanners` function then skips the primary banner because it checks `!slot.isAvailable`.

The `isAvailable` flag conflates two things: "can someone rent this slot?" vs "does this slot have an active primary banner?". A shared slot with a primary renter absolutely has a banner to show.

### Fix

**`src/components/bannerads/BannerDisplay.tsx`** — Change the primary banner check (line 28) from:
```
if (!slot.isAvailable && slot.ipfsHash)
```
to:
```
if (slot.user !== "cheesebannad" && slot.ipfsHash)
```

This directly checks whether a real user rented the slot, bypassing the misleading `isAvailable` flag. If the user is the contract itself, there's no banner. If a real account rented it, show their banner regardless of whether the shared half is still open.

### Files changed: 1

No other changes needed. The placeholder logic for the unrented shared half (line 52) and the shared renter logic (line 40) remain correct.

