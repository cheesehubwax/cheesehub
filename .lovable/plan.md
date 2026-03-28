

## Add Explicit Prohibition of Gambling Advertising in CHEESEAds

### Problem
The Terms currently only *warn users to exercise caution* with gambling ads (section 8, bullet 3). There's no explicit prohibition against advertising gambling, crypto casinos, etc.

### Changes

**File: `src/pages/Terms.tsx`**

1. **Section 8 (User Responsibilities), bullet 3** (line 86): Update the referral/affiliate links bullet to explicitly state that advertising gambling services is prohibited — not just cautioned against.

2. **Section 10 (Prohibited Use)** (line 109): Add a new bullet explicitly prohibiting gambling-related advertisements:
   - "Submitting banner advertisements through CHEESEAds that promote or link to gambling services, crypto casinos, betting platforms, lotteries, or any other form of wagering — whether real-money or cryptocurrency-based."

3. **Update the cautionary bullet** in section 8 to remove the gambling reference (since it's now prohibited, not just cautioned) and keep the warning for speculative trading and play-to-earn only.

### Files changed: 1
- `src/pages/Terms.tsx`

