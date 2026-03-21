

## Add placeholder banner for unrented shared slots (linking to /farm)

### Changes

**1. Copy uploaded image into project**
- Copy `user-uploads://cheese_banner4.png` → `src/assets/cheese_banner4.png`

**2. Update `src/components/bannerads/BannerDisplay.tsx`**

- Import the local image: `import cheeseBanner4 from "@/assets/cheese_banner4.png"`
- Extend `ActiveBanner` interface with optional `localSrc?: string` and `isPlaceholder?: boolean`; make `ipfsHash` optional
- In `extractActiveBanners`: when a shared slot has a primary renter but no `sharedUser` (and isn't suspended), push a placeholder banner: `{ localSrc: cheeseBanner4, websiteUrl: "/farm", user: "placeholder", isPlaceholder: true }`
- In render: if `current.localSrc` exists, render as `<Link to={current.websiteUrl}>` with `<img src={current.localSrc}>` instead of an external `<a>` with IPFS URL. Omit the "AD" label for placeholders.

### Files changed
1. `src/assets/cheese_banner4.png` (new)
2. `src/components/bannerads/BannerDisplay.tsx`

