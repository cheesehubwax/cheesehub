

## Plan: Ad click warning interstitial + domain blocklist

### Feature 1 — External link warning dialog

When a user clicks a banner ad that links externally, intercept the click and show a confirmation dialog displaying the destination domain. The user must confirm before navigating.

**`src/components/bannerads/ExternalLinkWarning.tsx`** (new)
- AlertDialog with title "You are leaving CHEESEHub"
- Shows the full destination domain extracted from the URL
- Warning text: "This link goes to an external website not controlled by CHEESEHub. Proceed at your own risk."
- Two buttons: "Go Back" (cancel) and "Continue to [domain]" (opens link in new tab)

**`src/components/bannerads/BannerDisplay.tsx`** (edit)
- Replace the `<a href={...}>` with a clickable div that opens the warning dialog
- Pass the sanitized URL to ExternalLinkWarning
- Placeholder banners (internal `<Link>`) remain unchanged — no interstitial needed for internal routes

### Feature 2 — Domain blocklist

Maintain a blocklist of known scam/malicious domains. Banners linking to blocked domains are silently hidden from display.

**`src/lib/bannerBlocklist.ts`** (new)
- Export a `BLOCKED_DOMAINS` set containing known scam domains (e.g. common phishing patterns)
- Export `isDomainBlocked(url: string): boolean` — extracts hostname from URL, checks against the set (including subdomain matching so `evil.blocked.com` is caught if `blocked.com` is blocked)

**`src/components/bannerads/BannerDisplay.tsx`** (edit)
- In `extractActiveBanners`, filter out any banner whose `websiteUrl` matches a blocked domain
- Blocked banners are silently excluded — they never render

**`src/components/bannerads/RentSlotDialog.tsx`** + **`EditBannerDialog.tsx`** (edit)
- When the user enters a website URL, check it against the blocklist
- Show inline validation error "This domain is not allowed" and disable the submit button

### Files changed
1. `src/components/bannerads/ExternalLinkWarning.tsx` — new warning dialog
2. `src/lib/bannerBlocklist.ts` — new blocklist utility
3. `src/components/bannerads/BannerDisplay.tsx` — integrate warning + blocklist filter
4. `src/components/bannerads/RentSlotDialog.tsx` — blocklist validation on URL input
5. `src/components/bannerads/EditBannerDialog.tsx` — blocklist validation on URL input

