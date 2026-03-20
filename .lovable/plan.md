

## Fix: CHEESEAmp Infinite Re-render Loop (Flashing Videos)

### Root Cause

There's a cascading render loop caused by two issues:

**1. Unstable `playlist` dependency in sync effect (CheeseAmpPlayer.tsx line 188)**
The "sync with currently playing track" effect depends on `playlist`, but calling `playlist.playTrack()` inside the effect updates state, which creates a new `playlist` object, re-triggering the effect -- infinite loop. This causes the rapid flashing between tracks.

**2. Unstable `activeTracks` array reference (CheeseAmpPlayer.tsx line 128-134)**
`activeTracks` is computed inline without `useMemo`, so every render creates a new array reference. This flows into `useCheeseAmpPlaylist` as `allTracks`, destabilizing all downstream memos and causing excess re-renders and the "Saving 0 playlists" spam.

### Changes

**`src/components/music/CheeseAmpPlayer.tsx`**
- Wrap `activeTracks` in `useMemo` so the array reference is stable across renders
- Fix the sync effect (lines 178-188): remove `playlist` from the dependency array, and add a guard using a ref to prevent re-triggering when the track is already synced. This breaks the loop.

**`src/hooks/useCheeseAmpPlaylist.ts`**
- No structural changes needed, but reduce the noisy `saveState` console.log to prevent log spam (optional cleanup)

### Technical Detail

The loop path is:
```text
sync effect fires (playlist in deps)
  → playlist.playTrack() called
    → updateState() → saveState() → setState()
      → new playlist object reference
        → sync effect fires again (playlist changed)
          → infinite loop
```

Fix: use `playlist.currentTrack` and `playlist.playTrack` as specific stable references (via useRef or extracted deps) instead of the entire `playlist` object.

### Files
- `src/components/music/CheeseAmpPlayer.tsx` — memoize activeTracks, fix sync effect deps
- `src/hooks/useCheeseAmpPlaylist.ts` — optional: reduce log noise

