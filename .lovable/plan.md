# Make the keyring and water-bottle drop images load

## What I confirmed just now

Both templates carry valid IPFS CIDs (`$CHEESE Metal Keyring` -> `QmYQRbxp...SEg9`, `Stainless Steel Insulated Bottle` -> `QmYTvGVY...UyeM`).

Tested in a real headless browser:

```text
resizer.atomichub.io/images/v1/preview?ipfs=<cid>&size=370   -> LOADS (179px / 370px image)
gateway.pinata.cloud/ipfs/<cid>                              -> hangs (8s, no response)
ipfs.io/ipfs/<cid>                                           -> hangs
atomichub-ipfs.com, ipfs.atomichub.io                        -> error
```

The content is no longer served by the public IPFS gateways we try first, but AtomicHub's own image cache — the exact service that renders the pictures you see on atomichub.io — serves both fine. That cache is already the LAST entry in our source chain, which is why the pictures never appear: the gateways ahead of it don't fail fast, they hang, and the current code walks them one or two at a time with long timeouts, so the working source is reached far too late (30-45s), or never when a hanging request never settles.

So this is a source-ordering and concurrency problem, not a missing-image problem.

## Changes

1. `src/lib/ipfsGateways.ts`
   - Add a resolver that returns every candidate URL for a CID, including the AtomicHub cache (`size=370`, the only size that reliably responds).
   - Expose the AtomicHub cache URL as a first-class fallback callers can use immediately, keeping `IPFS_IMAGE_SOURCES` for compatibility.

2. `src/components/drops/DropCard.tsx`
   - Replace the sequential batches-of-two escalation with one parallel race across all remaining sources at once; first image that actually decodes wins.
   - Trigger that race on the first error and on a short watchdog (~3.5s) instead of the current 12-25s timeout, so a hanging gateway can no longer stall the card.
   - Keep the existing Retry state for the case where every source fails.

3. `src/components/shared/IpfsImage.tsx` (drop detail page)
   - Same approach: race all sources in parallel with a short per-source timeout and render the first winner, instead of stepping through sources on 6s timeouts.

4. `src/services/atomicApi.ts`
   - `preloadImage` currently warms only the primary gateway URL, which for these CIDs can never succeed. Also warm the AtomicHub cache URL so grid images are typically already decoded before a card mounts.

## Verification

Load `/drops` and both drop detail pages in a headless browser, screenshot the two cards and the two detail views, and confirm the pictures render within a couple of seconds — no Retry state, no placeholder.