

## Surface Hidden Full-Length Tracks (audio1, audio2, etc.)

### Problem
Some music NFT schemas define additional audio fields like `audio1`, `audio2` beyond the main `audio` field. The `audio` field contains a 1-minute sample, while the numbered fields contain full-length tracks. CHEESEAmp currently ignores these fields entirely.

Both reported NFTs (from the `sublimesound` collection, schema `sdelgado.r1`) have this schema:
- `audio` (ipfs) — 1-min clip
- `video` (ipfs) — music video
- `audio1` (ipfs) — additional track
- `audio2` (ipfs) — additional track

### Changes

**1. `src/hooks/useMusicNFTs.ts` — Extract extra audio fields**
- Add `extraAudioUrls?: { label: string; url: string }[]` to the `MusicNFT` interface
- During asset parsing, scan `allData` for keys matching `audio1`, `audio2`, `audio3`, ... (and also `track`, `track1`, `track2`, `fulltrack`, `full_audio` patterns that other collections might use)
- Populate `extraAudioUrls` with label + resolved IPFS URL for each found field
- Do this in both the `fetchAssetMetadata` and `fetchApiPage` parsing paths

**2. `src/components/music/MediaDisplay.tsx` — Add extra audio display mode**
- Extend `DisplayMode` type to include `'audio1'`, `'audio2'`, etc. (use a union with string template or just use string)
- Update `MediaSelector` to accept extra audio entries and render additional buttons for each (e.g., "Track 2", "Track 3")

**3. `src/components/music/CheeseAmpPlayer.tsx` — Wire up extra audio playback**
- When user selects an extra audio track from the media selector, call `audioPlayer.play()` with a modified track that has the alternate `audioUrl`
- Pass `extraAudioUrls` from `currentTrack` to `MediaSelector`

**4. `src/lib/musicPlayer.ts` — Support playing alternate audio URL**
- Add a method or parameter to `play()` that accepts an override audio URL, so the same track can be played with a different source (the full-length version)

### Files
- `src/hooks/useMusicNFTs.ts` — extract `audio1`, `audio2`, etc.
- `src/components/music/MediaDisplay.tsx` — extra audio buttons in MediaSelector
- `src/components/music/CheeseAmpPlayer.tsx` — wire up alternate audio playback
- `src/lib/musicPlayer.ts` — support override audio URL

