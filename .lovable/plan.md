

# Fix Missing Banner Display + Navigation Cleanup

## Problem
There is no site-wide banner display component. The `useBannerSlots` hook fetches slot data but it's only used on the `/bannerads` management page. No component renders active (non-suspended, non-available) banner ads across the site.

## Changes

### 1. Create `src/components/bannerads/BannerDisplay.tsx`
A site-wide component that:
- Uses `useBannerSlots` to fetch today's active slots (filter by current UTC day timestamp, `!isAvailable`, `!suspended`)
- Renders a 580×150 banner image from the slot's IPFS hash, linked to the slot's `websiteUrl`
- If multiple active slots exist for today, rotates between them every ~8 seconds
- If a slot is shared, alternates between primary and shared user's banners
- Falls back to nothing (renders null) if no active banners exist for today
- Renders below the header, inside `Layout.tsx`
- Below the banner, add a small centered link: `Advertise with CHEESEHub` pointing to `/bannerads`

### 2. Update `src/components/Layout.tsx`
- Import and render `<BannerDisplay />` between `<Header />` and `<main>`

### 3. Update `src/components/Header.tsx`
- Remove the CHEESEFaucet external link (lines 52-61)
- Remove the CHEESEAds link from the secondary nav (lines 160-171)
- Remove unused `Megaphone` and one `Droplets` import

### 4. Update `src/components/Footer.tsx`
- Add an "Advertise with CHEESEHub" link (using `Link` from react-router-dom) pointing to `/bannerads`, placed before the copyright line

