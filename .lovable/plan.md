

## CheeseAmp Video Playback Fix

### Problem

Looking at the Sonic Calavera NFT (asset 1099874419204), its metadata is:
```text
data: {
  name: "Sonic Calavera - 2000 Souls",
  video: "Qmf3bJfHWurj7dATFWZ56Se8TsiBfu6ts1A7GgeYJjgFT9",
  Artist Info: "..."
}
schema fields: track 1, track 2, ... track 13 (type: ipfs)
No img, no image, no audio, no clip fields.
```

Three issues found:

**1. Video-only NFTs always start in audio mode (main issue)**

When a track is played, `play(track, preferVideo=false)` is called. This means `useVideo = false`, so even though the NFT only has a video file and no audio, it loads the video URL into an `<audio>` element. The user sees a spinning disc with (maybe) audio playing. They'd need to manually click a small "Video" button in the media selector to switch -- not obvious at all.

**2. Extra tracks with spaces in field names are ignored**

The schema has `track 1`, `track 2`, ... `track 13`. The regex `EXTRA_AUDIO_PATTERN` is `/^(audio\d+|track\d+|...)$/i` -- `track\d+` requires NO space between "track" and the number. So none of these 13 tracks are detected.

**3. No cover art fallback for video-only NFTs**

`coverArt` resolves from `img` or `image` fields, which don't exist on this NFT. Result: empty string, shows spinning disc in track list. Could use a frame from the video or at least show the collection image.

### Plan

**File: `src/hooks/useMusicNFTs.ts`**

- Update `EXTRA_AUDIO_PATTERN` to allow optional spaces: `/^(audio\s*\d+|track\s*\d+|fulltrack|full_audio|full_song|bonus_track)$/i`
- Add `videoOnly` boolean to `MusicNFT` interface: `true` when `videoUrl` exists but no separate `audio`/`clip` field
- When building `coverArt`, if `img`/`image` are missing but `video` exists, leave coverArt empty (no change) but set `videoOnly` so the player knows to auto-start video

**File: `src/lib/musicPlayer.ts`**

- In `play()`, auto-detect video-only tracks: if `track.videoUrl && !track.audioUrl` (or audioUrl === videoUrl), default to `useVideo = true` even when `preferVideo` is false
- This makes video-only NFTs start playing as video immediately, showing the actual video in the player

**File: `src/components/music/CheeseAmpPlayer.tsx`**

- When `handlePlayTrack` is called for a video-only track, set `displayMode` to `'video'` instead of `'cover'` so MediaDisplay renders the video container immediately

### Technical detail

```text
Current flow (video-only NFT):
  click play → audio mode → video file in <audio> element → spinning disc
  user must find and click "Video" button to see video

Fixed flow:
  click play → detect video-only → video mode → video in <video> element → video plays
```

### Files changed
- `src/hooks/useMusicNFTs.ts` -- fix space-in-field-name regex, add videoOnly flag
- `src/lib/musicPlayer.ts` -- auto-start video for video-only tracks  
- `src/components/music/CheeseAmpPlayer.tsx` -- set display mode to video for video-only tracks

