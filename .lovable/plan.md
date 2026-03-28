

## Fix Admin Edit Button Visibility on CHEESEAds

### Problem
Line 238 in `SlotCalendar.tsx` shows the Edit button to admins on **all** non-suspended slots. Admins should only see Edit on their **own** ads (with the 48hr buffer), same as regular users. Admins can only **Remove** other people's ads, not edit them.

### Change

**`src/components/bannerads/SlotCalendar.tsx`** — line 238

Current logic:
```
isAdmin || ((slot.user === accountName || slot.sharedUser === accountName) && isWithinBuffer(...))
```

New logic — remove `isAdmin ||`, keep only the owner check:
```
(slot.user === accountName || slot.sharedUser === accountName) && isWithinBuffer(slot.time, MIN_RENT_BUFFER_HOURS)
```

This means:
- Admins see Edit **only** on their own ads, with the 48hr buffer — same rules as everyone
- Admins still see Remove, Preview, Reinstate, and Review buttons on other people's ads (unchanged)

### Files changed: 1
- `src/components/bannerads/SlotCalendar.tsx`

