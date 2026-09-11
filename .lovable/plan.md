# CHEESEAir — thumbnails in the NFT template picker

## What you'll see

In CHEESEAir, when dropping NFTs, the "Template to airdrop" dropdown becomes a scrollable list
(like the collection picker above it): each template row shows a small square thumbnail on the
left, then the template name, `#id`, and `own N` count. The selected template's thumbnail also
shows on the collapsed picker.

## Changes

1. **Fetch the image** — `src/lib/airdropChain.ts` `getInventoryTemplates()` already calls
   `atomicassets/v1/templates` for names. Extend that same response parse to pull the image hash
   from `immutable_data.img` / `image` (same key scan the name lookup uses), and add
   `image?: string` to `InventoryTemplate`. No extra network calls.

2. **Replace the native `<select>`** — in `src/components/air/AirSendCard.tsx`, swap the
   `<select>` for a button-style list matching the existing collection-picker chips:
   - A trigger row showing the selected template (thumbnail + name + #id + count), or
     "Select a template…".
   - Clicking opens a `max-h-48 overflow-y-auto` list; each row is a button with a
     32px `IpfsImage` thumbnail (uses the existing gateway-racing component, so IPFS images
     that fail on one gateway fall through to the next), name, `#id`, and `own N`.
   - Templates with no image render `placeholder.svg` via `IpfsImage`'s fallback.

3. Keep all existing behavior: selection still drives `setNftTemplateId`, the loading and
   error lines below stay unchanged.

No new dependencies; `IpfsImage` from `src/components/shared/IpfsImage.tsx` is reused.

## Verification

- `bunx tsgo --noEmit` and production build pass.
- Playwright on `/air` with a wallet-owned template list is not possible unauthenticated, so
  verification is a typecheck + build plus a DOM-level check that the picker renders.
