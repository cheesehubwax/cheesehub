

## Fix: Playback pauses when switching from Playlists back to Library

### Root Cause

`selectPlaylist()` in `useCheeseAmpPlaylist.ts` blindly resets `currentIndex` to `-1` every time it's called. When clicking "Library", this makes `currentTrack` null, which unmounts `MediaDisplay`, detaching the `<video>` element from the DOM. The browser then auto-pauses the video — and since audio comes from the video element for video-only tracks, all playback stops.

### Fix

**File: `src/hooks/useCheeseAmpPlaylist.ts`** (lines 354-357)

Replace the blind `setCurrentIndex(-1)` in `selectPlaylist` with logic that preserves the currently-playing track's position:

- Get the audio player's current track
- If something is playing, compute the new playlist's track list and find the playing track's index in it
- Only reset to `-1` if nothing is playing or the track isn't in the new playlist

```text
Before:  selectPlaylist → setCurrentIndex(-1) → currentTrack=null → unmount video → pause
After:   selectPlaylist → find playing track in new list → keep index → video stays mounted
```

### Files changed
- `src/hooks/useCheeseAmpPlaylist.ts` — one function updated

