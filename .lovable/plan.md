

# Homepage Overhaul + CHEESEAds (CheeseBannAd) Feature

## What's Changing

### 1. Homepage — Match Original Exactly

The current homepage uses a `ToolCard` component with a `tools` array. The original repo inlines all tool cards directly with the exact emojis, BETA badges, and text from the screenshot. Key differences:

- **Title**: Add `BETA` badge next to "CHEESEHub"
- **CheesePriceBar**: Replace current implementation (uses CoinGecko + custom Alcor pool logic) with the original's Alcor Token API (`/api/v2/tokens/cheese-cheeseburger`) which returns `system_price` (WAX) and `usd_price` (USD) directly. Add Market Cap and TVL pills.
- **TokenStatsBanner**: Replace Phosphor icon-based grid with the original's emoji-based layout (5 columns: Total Supply, Locked, Circulating, Next Unlock, CHEESE Nulled with Popover breakdown). Add Contract Status row, "proof" links, and WaxBlock link.
- **CheeseHistorySection**: Replace timeline component with the original's prose-based history text, verification URL, JSON scroll box, and "History Verified" badge.
- **Tool cards**: Replace `ToolCard` component usage with inline `Card` components matching the original exactly (each with BETA badge, correct descriptions — notably CHEESEShip instead of CHEESEDrop, CHEESEAds card added, CHEESEFaucet removed from inline cards, CHEESEWallet gets "+ Burn NFTs" line, CHEESEAmp gets "+Global WAX Radio Feature").
- **Remove**: `QuickLinksSection` (not in original), the old `ToolCard` and `QuickLinksSection` components/exports.

### 2. Hook Refactors (useQuery migration)

Convert these hooks from manual `useState/useEffect` to `useQuery` to match original:
- **`useCheesePriceData`** — Replace entirely. New version uses `useQuery` and fetches from `https://wax.alcor.exchange/api/v2/tokens/cheese-cheeseburger`. Returns `{ waxPrice, usdPrice }` (not the current `priceInWax/priceInUsd/change24h` shape). All consumers updated.
- **`useCheeseStats`** — Wrap with `useQuery`, return `{ data, isLoading, isError }`.
- **`useCheeseTVL`** — Wrap with `useQuery`, manual refetch only (1hr stale), return `{ data, isLoading, refetch, isFetching }`.
- **`useWaxPrice`** — Remove entirely (WAX price now derived from CHEESE price data: `usdPrice / waxPrice`).

### 3. New: Null Breakdown Feature

- **`src/lib/cheeseNullBreakdown.ts`** — Hyperion-based per-contract null analysis (cheeseburner, cheesefeefee, cheesepowerz, cheesebannad) with 24h/7d breakdowns.
- **`src/hooks/useNullBreakdown.ts`** — `useQuery` wrapper, `enabled: false` (fetched on popover open).
- Used by `TokenStatsBanner` popover on the "CHEESE Nulled" stat.

### 4. New: CHEESEAds (BannerAds) Feature

Full implementation of the `cheesebannad` smart contract frontend:

**New Files:**
- `src/pages/BannerAds.tsx` — Page with orb, title, SlotCalendar, StatsBar
- `src/components/bannerads/SlotCalendar.tsx` — Main calendar view with slot badges, multi-select, bulk rent, admin moderation (edit/remove/reinstate/preview)
- `src/components/bannerads/RentSlotDialog.tsx` — Single slot rental (exclusive/shared, IPFS upload, pricing with 30% shared discount, 50% promoz discount)
- `src/components/bannerads/BulkRentDialog.tsx` — Multi-slot rental in single transaction
- `src/components/bannerads/EditBannerDialog.tsx` — Update IPFS hash and URL
- `src/components/bannerads/RemoveBannerDialog.tsx` — Admin: suspend with optional shared clear
- `src/components/bannerads/ReinstateBannerDialog.tsx` — Admin: lift suspension
- `src/components/bannerads/BannerAdStatsBar.tsx` — Lifetime stats (ads rented, CHEESE burnt, WAX flows)
- `src/hooks/useBannerSlots.ts` — Fetches bannerads table + config, groups by date
- `src/hooks/useBannerAdStats.ts` — Hyperion-based lifetime stats
- `src/hooks/useAdminAccess.ts` — Check admin whitelist on cheesebannad contract
- `src/lib/bannerAdStats.ts` — Stats fetcher (Hyperion transfers + table counts)
- `src/lib/adminData.ts` — Admin check + burner/feefee/bannad/powerz config fetchers
- `src/lib/ipfsGateways.ts` — IPFS gateway list with helpers
- `src/lib/sanitizeUrl.ts` — URL sanitization

**Routing:** Add `/bannerads` route in `App.tsx`.
**Nav:** Add CHEESEAds link to header.

### 5. Missing Assets

Need placeholder PNGs for: `cheese-bikini.png`, `cheese-token.png`, `wax-token.png`, `wallet-icon.png`. These will be created as simple placeholders since binary assets can't be fetched from GitHub raw.

### 6. Files to Delete/Update

- Remove `src/components/home/ToolCard.tsx`, `QuickLinksSection.tsx`
- Update `src/components/home/index.ts` exports
- Update `src/components/Header.tsx` to add CHEESEAds nav link

### Implementation Order

1. Create utility libs (`ipfsGateways`, `sanitizeUrl`, `adminData`, `bannerAdStats`, `cheeseNullBreakdown`)
2. Create/update hooks (`useCheesePriceData`, `useCheeseStats`, `useCheeseTVL`, remove `useWaxPrice`, add `useNullBreakdown`, `useBannerSlots`, `useBannerAdStats`, `useAdminAccess`)
3. Rewrite `CheesePriceBar`, `TokenStatsBanner`, `CheeseHistorySection`
4. Rewrite `Index.tsx` with inline cards matching original exactly
5. Create all BannerAds components and page
6. Update routing and navigation

