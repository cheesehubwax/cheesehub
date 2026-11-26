# Remove the navy borders from NFT and farm pictures

## What is happening
AtomicHub offers three cached copies of each picture. One of them (the "thumbnail") is really a social-media preview card: it is always 1200x630 and fills any empty space with navy blue. Checked on the squish.bat cover: the small preview and the original have no border, but the thumbnail copy has navy padding (corner colour 20,25,45). CHEESEHub requests all copies at the same time and shows whichever arrives first, so the padded thumbnail often wins. That is why banners get navy bars at the sides and square avatars/logos get navy edges.

## Fix
- Stop using AtomicHub's thumbnail copy anywhere on CHEESEHub.
- Order becomes: AtomicHub preview (fast) → AtomicHub original (full size, no border) → the normal IPFS gateways.
- Video and audio stay as they are.
- Pictures already sitting in the in-memory cache refresh on the next page load.

## Checks
- Update the existing picture tests so the thumbnail address can never be chosen again.
- Open /farm/squish.bat in the test browser and confirm the cover and logo have no navy edges, plus one CHEESEWallet NFT grid.

## Technical details
- `src/lib/ipfsGateways.ts`: remove `atomicHubThumbnailUrl` from `IPFS_IMAGE_SOURCES` (and the function if unused); update comments.
- `src/test/ipfsImages.test.ts`, `src/test/nftGridLoading.test.tsx`: adjust candidate index expectations.
- Update the NFT image rule in root `AGENTS.md` only if wording mentions the thumbnail (no new lines; it is at its size budget).
