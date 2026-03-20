

## Broaden Music NFT Detection + Add Media Selector Buttons

### Problem
1. Video-only NFTs (with just a `video` IPFS hash) are filtered out by `isMusicNFT()` because it requires `artist`, `title`, or `album` alongside `video`
2. NFTs with art assets (backimg, img) attached to music/video releases have no way to be viewed in the player

### Changes

**1. `src/hooks/useMusicNFTs.ts` — Broaden detection + capture more media fields**

- Relax `isMusicNFT()`: accept any NFT that has `audio`, `clip`, or `video` (drop the requirement for artist/title/album alongside video)
- Add new fields to the `MusicNFT` interface: `frontArt?: string`, `backArt?: string`, `additionalImages?: string[]` to capture all visual assets (img, backimg, frontimg, etc.)
- Populate these from the merged `allData` during asset parsing

**2. `src/components/music/MediaDisplay.tsx` — Add art viewing mode**

- Accept new optional props: `frontArt`, `backArt`
- Add a `displayMode` state: `'cover'` | `'video'` | `'front'` | `'back'`
- When viewing art, show the selected image in the player area with click-to-expand (lightbox overlay)

**3. `src/components/music/CheeseAmpPlayer.tsx` — Add media selector buttons below player**

- Below the cover art / video area, add a row of small icon buttons (like AtomicHub): Audio, Video (if available), Front Art, Back Art (if available)
- Clicking each switches what's displayed in the player area
- Pass the new art URLs from `currentTrack` down to `MediaDisplay`
- Add a simple lightbox component (full-screen overlay with close button) for expanding art

### Files
- `src/hooks/useMusicNFTs.ts` — relax filter, add art fields
- `src/components/music/MediaDisplay.tsx` — art display mode + lightbox
- `src/components/music/CheeseAmpPlayer.tsx` — media selector button row

