## Goal

In the CHEESEDrop → Official → Account Names sub-tab, replace the single flat grid with two stacked sections:

1. **Premium Accounts** — account name drops whose description marks them as premium
2. **Semi-Premium Accounts** — account name drops whose description marks them as semi-premium (and any other account name drops as a fallback)

Using the description (not price) so future price changes don't break the grouping.

## Changes

Single file: `src/pages/Drops.tsx`

- Add a small helper inside the component that classifies an account-name drop from its description text (lowercased, whitespace-collapsed). Matching rules:
  - Premium if the description contains "premium" but NOT "semi" / "semi-premium" / "semipremium" near it.
  - Semi-premium if the description contains "semi-premium", "semi premium", or "semipremium".
  - Anything else falls into the Semi-Premium bucket as a safe default so no drop disappears.
- Replace the `sortedAccountNames` memo with two memos derived from `accountNamesDrops`:
  - `premiumAccountDrops` — classifier returns `premium`, sorted by `dropId` asc.
  - `semiPremiumAccountDrops` — everything else, sorted by `dropId` asc.
- In the `accountnames` `TabsContent`, render two stacked titled sections:
  - "Premium Accounts" heading + count chip, then `<SimpleDropGrid drops={premiumAccountDrops} />` (muted empty-state line if none).
  - "Semi-Premium Accounts" heading + count chip, then `<SimpleDropGrid drops={semiPremiumAccountDrops} />` (muted empty-state line if none).
- Keep the Account Names tab trigger count as the combined total (`accountNamesDrops.length`).
- Headings use existing typography (`font-display text-2xl font-bold text-foreground` with a `text-muted-foreground` subline). No new design tokens, no other files touched.

## Description field

Drops carry a `description` string (already part of the enriched `NFTDrop` used by the grid). The classifier reads `drop.description ?? ''` defensively so missing values just fall through to Semi-Premium.

## Out of scope

- No change to Collectibles tab, CHEESE tab, My Drops, Create, or any other page.
- No change to drop fetching, enrichment, cart, or pricing logic.
- No edits to drop descriptions on-chain — classification is purely client-side display.
