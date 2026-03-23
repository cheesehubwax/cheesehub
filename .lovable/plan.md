

## Plan: localStorage-based admin review checkoffs for banner ads

Since localStorage is per-browser, each admin will only see their own checkoffs — not other admins'. This is a lightweight solution that still helps individual admins track which ads they've personally reviewed.

### How it works

- Each rented slot (identified by `time:position`) gets a checkoff entry stored in localStorage under a key like `cheese-ad-reviews-{adminAccount}`
- The stored data includes the admin's account name, timestamp, and a fingerprint of the ad content (hash of `ipfsHash + websiteUrl + sharedIpfsHash + sharedWebsiteUrl`)
- If the ad's content changes (image or URL edited), the fingerprint won't match and the checkoff is automatically invalidated
- A small checkbox/icon appears next to each rented slot in the SlotCalendar, visible only to admins

### Files to create/edit

**1. New: `src/lib/adReviewStorage.ts`**
- `getReviews(adminAccount): Record<string, ReviewEntry>` — load from localStorage
- `toggleReview(adminAccount, time, position, contentFingerprint)` — add/remove review
- `isReviewValid(adminAccount, time, position, currentFingerprint): boolean` — check if review exists and fingerprint matches
- Content fingerprint: simple string concat of `ipfsHash|websiteUrl|sharedIpfsHash|sharedWebsiteUrl`

**2. Edit: `src/components/bannerads/SlotCalendar.tsx`**
- Import review storage utilities
- For each rented slot (where `user !== BANNER_CONTRACT`), show a review checkbox visible only to admins
- Checkbox is checked if the current admin has a valid review for that slot
- Clicking toggles the review; if content has changed since last review, it shows as unchecked
- Small text label: "Reviewed by you" or "Not reviewed" next to the checkbox
- Style: subtle, doesn't interfere with existing rent/edit buttons

### Limitation note
Since this uses localStorage, Admin A cannot see Admin B's reviews. Each admin tracks their own reviews independently.

