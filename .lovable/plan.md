

## Make All NFT Images Visible — Match AtomicHub's Coverage

### Why Some NFTs Show on AtomicHub but Not Here

Three root causes identified:

**1. Limited image field detection**
Our `getMediaUrl()` in `useUserNFTs.ts` only checks `img`, `image`, and `video`. Many NFTs store images in other fields like `backimg`, `frontimg`, `glbimg`, or custom keys. AtomicHub checks all data fields for image-like content. Same issue exists in `atomicApi.ts`.

**2. NFTGridCard uses a duplicate, outdated IPFS gateway list**
`NFTGridCard.tsx` has its own hardcoded gateway list (4 gateways) instead of importing from the shared `ipfsGateways.ts` (5 gateways, better ordering). It's also missing `nftstorage.link` and the AtomicHub IPFS CDN.

**3. No AtomicHub IPFS CDN**
AtomicHub routes all images through `atomichub-ipfs.com`, which is extremely reliable. We don't include this gateway anywhere.

### Changes

**File 1: `src/lib/ipfsGateways.ts`**
- Add `https://atomichub-ipfs.com/ipfs/` as the first gateway (most reliable for WAX NFTs)
- This propagates to all consumers of the shared gateway list

**File 2: `src/hooks/useUserNFTs.ts`**
- Expand `getMediaUrl()` to scan all data fields for image-like values when `img`/`image`/`video` are missing
- Check additional known fields: `backimg`, `frontimg`, `glbimg`, `pfp`, `logo`, `icon`
- As a final fallback, scan all string values for IPFS hashes or image URLs
- Import and use `getIpfsUrl` from the shared module instead of the local `IPFS_GATEWAY` constant

**File 3: `src/services/atomicApi.ts`**
- Apply the same expanded `getMediaUrl()` logic for consistency across drops and template fetching

**File 4: `src/components/shared/NFTGridCard.tsx`**
- Remove the duplicate `IPFS_GATEWAYS` array and `extractIpfsHash` function
- Import both from `@/lib/ipfsGateways` (shared module)

### How the expanded image detection works

```text
Priority order:
1. data.img or data.image        → standard fields
2. data.video                    → video NFTs
3. data.backimg / frontimg / glbimg / pfp / logo / icon → known alternates
4. Scan ALL string values for IPFS hashes (Qm.../bafy...) or http image URLs
5. → placeholder.svg only if nothing found
```

### Files changed: 4

