
Goal: make CHEESEAmp show an explicit track selector for NFTs like these Samuel Delgado releases, where the 1-minute sample and the full track are both present but the full track is currently hidden behind confusing toggle behavior.

What I found
- The current parser only exposes extra tracks from fields like `audio1`, `audio2`, `track1`, etc.
- These two NFTs do not populate those fields in the actual asset data; they only populate `audio` and `video`.
- The player currently mixes two different concepts:
  - visual display selection (`cover`, `video`, `front`, `back`)
  - playback source selection (sample vs full track)
- `musicPlayer.play(track)` defaults to preferring `videoUrl`, while the UI buttons in `CheeseAmpPlayer` use toggle-style logic (`switchMediaType`) based on current state, not explicit source selection.
- Result: users can accidentally bounce between sample/full track by clicking “Audio”/“Video”, but there is no visible selector telling them those are different track sources.

Implementation plan

1. Normalize hidden full tracks during NFT parsing
- Update `src/hooks/useMusicNFTs.ts`.
- Keep existing detection for `audio1`, `audio2`, etc.
- Add a derived extra-audio entry when an NFT has both `audio` and `video` and they are different URLs.
- For these cases, expose the `video` URL as a selectable extra track (label like `Full Track`).
- This ensures those two reported NFTs actually produce a visible second track button.

2. Separate playback source from display mode
- Update `src/components/music/CheeseAmpPlayer.tsx`.
- Add explicit state for the selected source, instead of inferring it from `displayMode` and `playbackState.isVideo`.
- Treat these as separate controls:
  - source buttons: `Sample`, `Full Track`, plus any numbered extras
  - display buttons: `Cover`, `Video`, `Front Art`, `Back Art`
- Reset the selected extra source when changing tracks.

3. Make the player API explicit instead of toggle-based
- Update `src/lib/musicPlayer.ts`.
- Replace the ambiguous `play(track, preferVideo, overrideAudioUrl?)` usage with a clearer approach internally:
  - play the exact requested media URL
  - optionally render through video mode when the user actually wants video display
- Keep `switchMediaType` only for true visual video switching, not for hidden sample/full-track switching.

4. Update the selector UI labels
- Update `src/components/music/MediaDisplay.tsx`.
- Rename the current `Audio` button to `Sample` when an alternate full track exists.
- Render explicit extra-track buttons such as `Full Track`, `Track 2`, `Track 3`.
- Keep art/video controls visible, but no longer rely on them to change which song version is playing.

Technical details
```text
Current behavior:
track click -> player may prefer videoUrl
Audio/Video buttons -> toggle relative state
Result -> hidden, stateful sample/full switching

Target behavior:
track click -> default to Sample
selector shows:
  [Sample] [Full Track] [Video] [Front Art] [Back Art]
clicking Sample -> always sample URL
clicking Full Track -> always full-track URL
clicking Video -> changes visual/video playback mode explicitly
```

Files to update
- `src/hooks/useMusicNFTs.ts`
- `src/components/music/CheeseAmpPlayer.tsx`
- `src/components/music/MediaDisplay.tsx`
- `src/lib/musicPlayer.ts`

Expected outcome
- The two reported NFTs will show an obvious second track button.
- Users will no longer need to “click Audio twice” to discover the full version.
- CHEESEAmp will behave predictably for other collections that hide alternate tracks in `video` or numbered audio fields.
